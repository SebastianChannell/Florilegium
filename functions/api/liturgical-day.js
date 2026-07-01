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
  ordo: { summaryLines: ['Commemoration of St. Paul', 'Apostle', 'III class', 'Red'], fullText: 'External Ordo is temporarily unavailable. Fallback: Commemoration of St. Paul, Apostle, III class, Red.' },
};

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
  return text
    .replace(/&#(x?[0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value.replace(/^x/i, ''), value.toLowerCase().startsWith('x') ? 16 : 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"');
}

function strip(html) {
  return decodeEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(h[1-6]|p|div|section|article|li|br|tr)[^>]*>/gi, '\n')
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

function cleanOrdoText(text) {
  const clean = strip(text);
  const start = clean.search(/(?:^|\n)\s*Mass:\s*/i);
  let core = start >= 0 ? clean.slice(start).trim() : clean;
  const end = core.search(/(?:^|\n)\s*(?:Today\s*-\s*1962\s*Ordo|How to bookmark this application|Android|iOS|Windows)\b/i);
  if (end > 0) core = core.slice(0, end).trim();
  return core;
}

function sectionAfter(label, text, nextLabels = []) {
  const next = nextLabels.length ? String.raw`(?=\n\s*(?:${nextLabels.join('|')}):|$)` : '$';
  return new RegExp(String.raw`(?:^|\n)\s*${label}:\s*([\s\S]*?)${next}`, 'i').exec(text)?.[1]?.trim() || '';
}

function parseOrdo(text) {
  const core = cleanOrdoText(text);
  const mass = sectionAfter('Mass', core, ['Breviary']);
  const breviary = sectionAfter('Breviary', core).replace(/Today\s*-\s*1962\s*Ordo[\s\S]*/i, '').trim();
  const fullText = [mass && `Mass:\n${mass}`, breviary && `Breviary:\n${breviary}`].filter(Boolean).join('\n\n') || core || FALLBACK.ordo.fullText;
  const color = /\b(Red|White|Green|Violet|Black|Rose)\b/i.exec(fullText)?.[1] || FALLBACK.today.color;
  const className = normalizeClass(/\b([IVX]+)\s+class\b/i.exec(fullText)?.[0]);
  const massTitle = mass.split(/[.;\n]/).find((line) => /[A-Za-z]/.test(line))?.trim();
  const title = massTitle || fullText.split(/\n|\s{2,}|\|/).find((line) => /[A-Za-z]/.test(line))?.slice(0, 120) || FALLBACK.today.title;
  const summaryTitle = title.replace(/–.*/, '').replace(/\s+/g, ' ').trim();
  return {
    title,
    className,
    color,
    tonus: /solemn/i.test(fullText) ? 'Tonus Solemnis' : FALLBACK.today.tonus,
    summaryLines: [summaryTitle.slice(0, 34), className.replace('Classis', 'class'), color].filter(Boolean),
    fullText,
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
    // These public sites do not expose a stable JSON API. Parsing is intentionally conservative and falls back if markup changes.
    const [ordoHtml, missalHtml, divinumHtml] = await Promise.allSettled([
      fetchText(`https://1962ordo.today/day/${date}`),
      fetchText(`https://www.missalemeum.com/en/${date}`),
      fetchText(`https://www.divinumofficium.com/cgi-bin/missa/missa.pl?date=${date}&version=Rubrics%201960&lang2=English`),
    ]);
    const ordoText = ordoHtml.status === 'fulfilled' ? ordoHtml.value : '';
    const missalSource = missalHtml.status === 'fulfilled' ? missalHtml.value : divinumHtml.status === 'fulfilled' ? divinumHtml.value : '';
    const parsed = parseOrdo(ordoText || missalSource);
    const mass = normalizeMassText(missalSource);
    data = {
      today: { title: parsed.title, className: parsed.className, color: parsed.color, tonus: parsed.tonus },
      readings: { title: 'Mass of the Day', references: mass.references, propers: mass.propers },
      ordo: { summaryLines: parsed.summaryLines, fullText: parsed.fullText },
      isFallback: false,
    };
  } catch (error) {
    data.error = String(error.message || error);
  }

  const response = json(data);
  waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
