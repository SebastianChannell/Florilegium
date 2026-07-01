const FALLBACK = {
  today: { title: 'Commemoration of St. Paul, Apostle–R (III)', className: 'I Classis', color: 'Red', tonus: 'Tonus Solemnis' },
  readings: {
    title: 'Mass of the Day',
    references: ['Acts 13:26–33', 'John 14:1–6'],
    propers: {
      introit: 'External propers are temporarily unavailable.',
      collect: 'O God, who hast taught the multitude of the Gentiles by the preaching of blessed Paul the Apostle: grant us, we beseech Thee, that we who keep his memory may feel the benefit of his patronage.',
      epistle: 'Acts 13:26–33',
      gradual: '',
      alleluia: '',
      tract: '',
      gospel: 'John 14:1–6',
      offertory: '',
      secret: '',
      preface: '',
      communion: '',
      postcommunion: '',
      commemorations: '',
    },
  },
  ordo: {
    summaryLines: ['Mass: Commemoration of St. Paul', 'Breviary: III class', 'Red'],
    fullText: 'External Ordo is temporarily unavailable. Fallback: Commemoration of St. Paul, Apostle, III class, Red.',
    sections: {
      mass: 'Commemoration of St. Paul, Apostle, III class, Red.',
      breviary: 'Commemoration of St. Paul, Apostle, III class, Red.',
    },
    sourceUrl: 'https://1962ordo.today',
  },
};

const ORDO_BASE_URL = 'https://1962ordo.today';

const PROPER_KEYS = [
  ['introit', ['Introit']],
  ['collect', ['Collect']],
  ['epistle', ['Epistle', 'Lesson', 'Reading']],
  ['gradual', ['Gradual']],
  ['alleluia', ['Alleluia']],
  ['tract', ['Tract']],
  ['gospel', ['Gospel']],
  ['offertory', ['Offertory']],
  ['secret', ['Secret']],
  ['preface', ['Preface']],
  ['communion', ['Communion']],
  ['postcommunion', ['Postcommunion', 'Post Communion']],
  ['commemorations', ['Commemoration', 'Commemorations']],
];
const HEADING_PATTERN = PROPER_KEYS.flatMap(([, names]) => names).sort((a, b) => b.length - a.length).join('|');

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Sacrum Florilegium liturgical dashboard' } });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.text();
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/&#(x?[0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value.replace(/^x/i, ''), value.toLowerCase().startsWith('x') ? 16 : 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"');
}

function strip(html, options = {}) {
  const keepScripts = Boolean(options.keepScripts);
  return decodeEntities(String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>/gi, keepScripts ? '\n' : ' ')
    .replace(/<\/script>/gi, keepScripts ? '\n' : ' ')
    .replace(/<(h[1-6]|p|div|section|article|li|br|tr|td|th)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

function findRefs(text) {
  const refs = [...text.matchAll(/\b(?:[1-3]\s*)?[A-Z][a-z]+\s+\d{1,3}[:.]\d{1,3}(?:[–-]\d{1,3})?/g)].map((match) => match[0].replace('.', ':'));
  return [...new Set(refs)].slice(0, 4);
}

function normalizeClass(value) {
  if (!value) return FALLBACK.today.className;
  return value.replace(/class/i, 'Classis').replace(/\bI\s+Classis\b/i, 'I Classis');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionLabelPattern(label) {
  return String.raw`${escapeRegExp(label)}\b\s*(?::|\n|$)`;
}

function hasSectionHeading(label, text) {
  return new RegExp(String.raw`(?:^|\n)\s*${sectionLabelPattern(label)}`, 'i').test(text);
}

function scoreOrdoCandidate(html) {
  const clean = strip(html, { keepScripts: true });
  let score = 0;
  if (hasSectionHeading('Mass', clean)) score += 2;
  if (hasSectionHeading('Breviary', clean)) score += 3;
  if (/\b(?:[IVX]+)\s+class\b/i.test(clean)) score += 1;
  if (/\b(?:Red|White|Green|Violet|Black|Rose)\b/i.test(clean)) score += 1;
  return score;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function ordoCandidateUrls(date) {
  return unique([
    ORDO_BASE_URL,
    `${ORDO_BASE_URL}/day/${date}`,
    `${ORDO_BASE_URL}/${date}`,
    `${ORDO_BASE_URL}/?date=${date}`,
    `${ORDO_BASE_URL}/today`,
  ]);
}

async function fetchOrdoSource(date) {
  const attempts = await Promise.allSettled(ordoCandidateUrls(date).map(async (url) => ({ url, html: await fetchText(url) })));
  const fulfilled = attempts
    .filter((attempt) => attempt.status === 'fulfilled')
    .map((attempt) => ({ ...attempt.value, score: scoreOrdoCandidate(attempt.value.html) }))
    .sort((a, b) => b.score - a.score);
  const best = fulfilled.find((entry) => entry.score > 0);
  if (!best) throw new Error('No Mass/Breviary headings found on 1962 Ordo source');
  return best;
}

function cleanOrdoText(text) {
  const clean = strip(text, { keepScripts: true });
  const start = clean.search(new RegExp(String.raw`(?:^|\n)\s*(?:Mass|Breviary)\b\s*(?::|\n|$)`, 'i'));
  let core = start >= 0 ? clean.slice(start).trim() : clean;
  const end = core.search(/(?:^|\n)\s*(?:Today\s*-\s*1962\s*Ordo|How to bookmark this application|Android|iOS|Windows|FAQ|Blessings)\b/i);
  if (end > 0) core = core.slice(0, end).trim();
  return core.replace(/\n{3,}/g, '\n\n').trim();
}

function sectionAfter(label, text, nextLabels = []) {
  const next = nextLabels.length
    ? String.raw`(?=\n\s*(?:${nextLabels.map(sectionLabelPattern).join('|')})|$)`
    : '$';
  const pattern = String.raw`(?:^|\n)\s*${sectionLabelPattern(label)}\s*([\s\S]*?)${next}`;
  return new RegExp(pattern, 'i').exec(text)?.[1]?.trim() || '';
}

function firstMeaningfulLine(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.replace(/^[•*\-–—\s]+/, '').replace(/\s+/g, ' ').trim())
    .find((line) => /[A-Za-z]/.test(line) && !/^(Mass|Breviary)$/i.test(line)) || '';
}

function shorten(value, max = 40) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

function parseOrdo(text, sourceUrl = ORDO_BASE_URL) {
  const core = cleanOrdoText(text);
  const mass = sectionAfter('Mass', core, ['Breviary']);
  const breviary = sectionAfter('Breviary', core).replace(/Today\s*-\s*1962\s*Ordo[\s\S]*/i, '').trim();
  const fullText = [mass && `Mass:\n${mass}`, breviary && `Breviary:\n${breviary}`].filter(Boolean).join('\n\n') || core || FALLBACK.ordo.fullText;
  const color = /\b(Red|White|Green|Violet|Black|Rose)\b/i.exec(fullText)?.[1] || FALLBACK.today.color;
  const className = normalizeClass(/\b([IVX]+)\s+class\b/i.exec(fullText)?.[0]);
  const massHeadline = firstMeaningfulLine(mass || fullText);
  const breviaryHeadline = firstMeaningfulLine(breviary);
  const title = massHeadline || fullText.split(/\n|\s{2,}|\|/).find((line) => /[A-Za-z]/.test(line))?.slice(0, 120) || FALLBACK.today.title;
  return {
    title,
    className,
    color,
    tonus: /solemn/i.test(fullText) ? 'Tonus Solemnis' : FALLBACK.today.tonus,
    summaryLines: [
      massHeadline && `Mass: ${shorten(massHeadline, 34)}`,
      breviaryHeadline && `Breviary: ${shorten(breviaryHeadline, 30)}`,
      [className.replace('Classis', 'class'), color].filter(Boolean).join(' · '),
    ].filter(Boolean),
    fullText,
    sections: {
      mass: mass || '',
      breviary: breviary || '',
    },
    sourceUrl,
  };
}

function extractSections(text) {
  const propers = { ...FALLBACK.readings.propers };
  const clean = strip(text);
  if (!clean) return propers;

  // Missal sites commonly render propers as labelled sections. This parser keeps
  // complete section text between labels instead of truncating readings/propers.
  const regex = new RegExp(`(?:^|\\n)\\s*(${HEADING_PATTERN})\\s*(?:\\n|:)`, 'gi');
  const matches = [...clean.matchAll(regex)];
  matches.forEach((match, index) => {
    const label = match[1].toLowerCase();
    const key = PROPER_KEYS.find(([, names]) => names.some((name) => name.toLowerCase() === label))?.[0];
    if (!key) return;
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? clean.length;
    const value = clean.slice(start, end).trim();
    if (value) propers[key] = value;
  });

  if (!matches.length) propers.introit = clean;
  return propers;
}

function normalizeMassText(html) {
  const clean = strip(html);
  const propers = extractSections(html);
  const references = findRefs(clean);
  return { propers, references: references.length ? references : FALLBACK.readings.references };
}

export async function onRequestGet({ request, waitUntil }) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/api/liturgical-day?date=${date}&rubrics=1960`);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let data = { ...FALLBACK, isFallback: true };
  try {
    // 1962ordo.today is the Ordo source. MissaleMeum/Divinum Officium remain only for the Mass propers text.
    const [ordoResult, missalHtml, divinumHtml] = await Promise.allSettled([
      fetchOrdoSource(date),
      fetchText(`https://www.missalemeum.com/en/${date}`),
      fetchText(`https://www.divinumofficium.com/cgi-bin/missa/missa.pl?date=${date}&version=Rubrics%201960&lang2=English`),
    ]);
    const ordoSource = ordoResult.status === 'fulfilled' ? ordoResult.value : { html: '', url: ORDO_BASE_URL };
    const missalSource = missalHtml.status === 'fulfilled' ? missalHtml.value : divinumHtml.status === 'fulfilled' ? divinumHtml.value : '';
    const parsed = parseOrdo(ordoSource.html || missalSource, ordoSource.url || ORDO_BASE_URL);
    const mass = normalizeMassText(missalSource);
    data = {
      today: { title: parsed.title, className: parsed.className, color: parsed.color, tonus: parsed.tonus },
      readings: { title: 'Mass of the Day', references: mass.references, propers: mass.propers },
      ordo: { summaryLines: parsed.summaryLines, fullText: parsed.fullText, sections: parsed.sections, sourceUrl: parsed.sourceUrl },
      isFallback: !ordoSource.html,
    };
  } catch (error) {
    data.error = String(error.message || error);
  }

  const response = json(data);
  waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
