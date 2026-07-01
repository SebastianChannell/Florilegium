const FALLBACK = {
  today: { title: 'Commemoration of St. Paul, Apostle–R (III)', className: 'I Classis', color: 'Red', tonus: 'Tonus Solemnis' },
  readings: {
    title: 'Mass of the Day',
    references: ['Acts 13:26–33', 'John 14:1–6'],
    propers: {
      introit: 'External propers are temporarily unavailable.',
      collect: 'O God, who hast taught the multitude of the Gentiles by the preaching of blessed Paul the Apostle: grant us, we beseech Thee, that we who keep his memory may feel the benefit of his patronage.',
      epistle: 'Acts 13:26–33', gradual: '', alleluia: '', tract: '', gospel: 'John 14:1–6', offertory: '', secret: '', preface: '', communion: '', postcommunion: '', commemorations: '',
    },
  },
  ordo: {
    feastName: 'Commemoration of St. Paul, Apostle',
    className: 'III class',
    color: 'Red',
    summaryLines: ['Commemoration of St. Paul, Apostle', 'III class', 'Red'],
    mass: 'Mass of the day; Gloria; common preface.',
    breviary: { sections: [] },
    fullText: 'External Ordo is temporarily unavailable. Fallback: Commemoration of St. Paul, Apostle, III class, Red.',
  },
};

const PROPER_KEYS = [
  ['introit', ['Introit']], ['collect', ['Collect']], ['epistle', ['Epistle', 'Lesson', 'Reading']],
  ['gradual', ['Gradual']], ['alleluia', ['Alleluia']], ['tract', ['Tract']], ['gospel', ['Gospel']],
  ['offertory', ['Offertory']], ['secret', ['Secret']], ['preface', ['Preface']], ['communion', ['Communion']],
  ['postcommunion', ['Postcommunion', 'Post Communion']], ['commemorations', ['Commemoration', 'Commemorations']],
];
const HEADING_PATTERN = PROPER_KEYS.flatMap(([, names]) => names).sort((a, b) => b.length - a.length).join('|');
const BREVIARY_HEADINGS = ['Matins', 'Lauds', 'Prime', 'Hours', 'Vespers', 'I Vespers', 'II Vespers', 'Compline'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'Sacrum Florilegium liturgical dashboard' } });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.text();
}

function strip(html) {
  return html
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
    .trim();
}

function findRefs(text) {
  const refs = [...text.matchAll(/\b(?:[1-3]\s*)?[A-Z][a-z]+\s+\d{1,3}[:.]\d{1,3}(?:[–-]\d{1,3})?/g)].map((match) => match[0].replace('.', ':'));
  return [...new Set(refs)].slice(0, 4);
}

function normalizeClass(value) {
  if (!value) return FALLBACK.ordo.className;
  return value.replace(/classis/i, 'class').replace(/\s+/g, ' ').trim();
}

function parseFeastClassColor(clean) {
  const color = /\b(Red|White|Green|Violet|Black|Rose)\b/i.exec(clean)?.[1] || FALLBACK.ordo.color;
  const className = normalizeClass(/\b[IVX]+\s+(?:class|classis)\b/i.exec(clean)?.[0]);
  const lines = clean.split('\n').map((line) => line.trim()).filter(Boolean);
  const feastName = lines.find((line) => !/^(Mass|Breviary|Matins|Lauds|Prime|Hours|Vespers|Compline|Ordo)\b/i.test(line) && /[A-Za-z]/.test(line))?.replace(/\s*[–-]\s*(?:[IVX]+\s+(?:class|classis)|Red|White|Green|Violet|Black|Rose).*$/i, '') || FALLBACK.ordo.feastName;
  return { feastName, className, color };
}

function firstMatchSection(text, startHeading, endHeadings) {
  const endPattern = endHeadings.join('|');
  const regex = new RegExp(`${startHeading}\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:${endPattern})\\s*:|$)`, 'i');
  return regex.exec(text)?.[1]?.trim() || '';
}

function parseBreviarySections(breviaryText) {
  const sections = [];
  const headings = BREVIARY_HEADINGS.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const headingPattern = headings.join('|');
  const regex = new RegExp(`(?:^|\\n)\\s*(${headingPattern})\\s*:?\\s*`, 'gi');
  const matches = [...breviaryText.matchAll(regex)];
  matches.forEach((match, index) => {
    const label = match[1].trim();
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? breviaryText.length;
    const text = breviaryText.slice(start, end).trim();
    if (text) sections.push({ label, text });
  });
  return sections;
}

function parseOrdo(html) {
  const clean = strip(html);
  const base = parseFeastClassColor(clean);
  const mass = firstMatchSection(clean, 'Mass', ['Breviary', 'Matins', 'Lauds', 'Prime', 'Hours', 'I Vespers', 'II Vespers', 'Vespers', 'Compline', 'Print', 'Reminder']) || FALLBACK.ordo.mass;
  const breviarySource = firstMatchSection(clean, 'Breviary', ['Print', 'Reminder', 'Notes', 'Sources']) || clean;
  let sections = parseBreviarySections(breviarySource);

  // The Ordo page can format breviary details as separate heading blocks without a
  // parent “Breviary” wrapper. If so, parse directly from the full text.
  if (!sections.length) sections = parseBreviarySections(clean);

  return {
    ...base,
    summaryLines: [base.feastName, base.className, base.color].filter(Boolean),
    mass,
    breviary: { sections },
    fullText: clean || FALLBACK.ordo.fullText,
  };
}

function extractSections(text) {
  const propers = { ...FALLBACK.readings.propers };
  const clean = strip(text);
  if (!clean) return propers;
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

function isToday(date) {
  const now = new Date();
  const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return date === local;
}

async function fetch1962Ordo(date) {
  const urls = isToday(date)
    ? ['https://1962ordo.today/', `https://1962ordo.today/day/${date}`]
    : [`https://1962ordo.today/day/${date}`, 'https://1962ordo.today/'];
  const errors = [];
  for (const url of urls) {
    try { return await fetchText(url); } catch (error) { errors.push(String(error.message || error)); }
  }
  throw new Error(errors.join('; '));
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
    const [ordoHtml, missalHtml, divinumHtml] = await Promise.allSettled([
      fetch1962Ordo(date),
      fetchText(`https://www.missalemeum.com/en/${date}`),
      fetchText(`https://www.divinumofficium.com/cgi-bin/missa/missa.pl?date=${date}&version=Rubrics%201960&lang2=English`),
    ]);
    const ordoSource = ordoHtml.status === 'fulfilled' ? ordoHtml.value : '';
    const missalSource = missalHtml.status === 'fulfilled' ? missalHtml.value : divinumHtml.status === 'fulfilled' ? divinumHtml.value : '';
    const parsedOrdo = parseOrdo(ordoSource || missalSource);
    const mass = normalizeMassText(missalSource);
    data = {
      today: { title: parsedOrdo.feastName, className: parsedOrdo.className, color: parsedOrdo.color, tonus: FALLBACK.today.tonus },
      readings: { title: 'Mass of the Day', references: mass.references, propers: mass.propers },
      ordo: parsedOrdo,
      isFallback: false,
    };
  } catch (error) {
    data.error = String(error.message || error);
  }

  const response = json(data);
  waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
