const PROPERS_CATALOG_URL = '/data/missal/1962/propers-en.json';
const PROPER_MAP_URL = '/data/missal/1962/proper-map-2026.json';
const RAW_BASE = 'https://raw.githubusercontent.com/DivinumOfficium/divinum-officium/master/web/www/missa/English';

const cache = new Map();

const SECTION_MAP = {
  Introitus: 'introit',
  Oratio: 'collect',
  Lectio: 'epistle',
  Graduale: 'gradual',
  GradualeP: 'alleluia',
  Tractus: 'tract',
  Evangelium: 'gospel',
  Offertorium: 'offertory',
  Secreta: 'secret',
  Communio: 'communion',
  Postcommunio: 'postcommunion',
};

const DIVINUM_SOURCE = {
  name: 'Divinum Officium',
  repository: 'https://github.com/DivinumOfficium/divinum-officium',
  license: 'MIT',
};

async function loadJson(url) {
  if (cache.has(url)) return cache.get(url);
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  const data = await response.json();
  cache.set(url, data);
  return data;
}

async function loadText(url) {
  if (cache.has(url)) return cache.get(url);
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  const text = await response.text();
  cache.set(url, text);
  return text;
}

function parseSections(text) {
  const sections = {};
  let current = null;
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) {
      current = heading[1];
      sections[current] = [];
      continue;
    }
    if (current) sections[current].push(line);
  }
  return Object.fromEntries(Object.entries(sections).map(([key, lines]) => [key, lines.join('\n').trim()]));
}

function cleanLine(line) {
  return String(line || '')
    .replace(/^v\.\s*/i, '')
    .replace(/^_$/g, '')
    .replace(/^!Tractus$/g, '')
    .replace(/^&Gloria$/g, 'Glory be to the Father, and to the Son, and to the Holy Ghost.')
    .replace(/^\$.*$/g, '')
    .trim();
}

function normalizeSection(raw) {
  if (!raw) return null;
  const references = [];
  const text = [];
  let introduction = '';

  for (const line of raw.split('\n').map(cleanLine).filter(Boolean)) {
    if (line.startsWith('!')) {
      references.push(line.slice(1).trim().replace(/\.$/, ''));
      continue;
    }
    if (!introduction && /^(Reading|A reading|Continuation|Lesson)/i.test(line)) {
      introduction = line;
      continue;
    }
    text.push(line);
  }

  return introduction || references.length || text.length
    ? { ...(introduction ? { introduction } : {}), ...(references.length ? { references } : {}), text }
    : null;
}

function formatSection(section) {
  if (!section) return '';
  if (typeof section === 'string') return section;
  const references = Array.isArray(section.references) ? section.references.join('\n') : '';
  const text = Array.isArray(section.text) ? section.text.join('\n') : (section.text || '');
  return [section.introduction, references, text].filter(Boolean).join('\n');
}

function getReadingReference(section) {
  if (!section?.references?.length) return '';
  return section.references[0];
}

function normalizeProper(properId, proper, catalog) {
  const sections = proper?.sections || {};
  const epistleRef = getReadingReference(sections.epistle || sections.lesson);
  const gospelRef = getReadingReference(sections.gospel);

  return {
    properId,
    title: proper?.title || '',
    source: catalog?.source || DIVINUM_SOURCE,
    sourcePaths: proper?.sourcePaths || [],
    references: [epistleRef, gospelRef].filter(Boolean),
    propers: {
      introit: formatSection(sections.introit),
      collect: formatSection(sections.collect),
      epistle: formatSection(sections.epistle || sections.lesson),
      gradual: formatSection(sections.gradual),
      alleluia: formatSection(sections.alleluia),
      tract: formatSection(sections.tract),
      gospel: formatSection(sections.gospel),
      offertory: formatSection(sections.offertory),
      secret: formatSection(sections.secret),
      preface: formatSection(sections.preface),
      communion: formatSection(sections.communion),
      postcommunion: formatSection(sections.postcommunion),
      commemorations: formatSection(sections.commemorations),
    },
  };
}

function getMapValue(mapping) {
  if (!mapping) return null;
  if (typeof mapping === 'string') return { properId: mapping };
  return mapping;
}

async function fetchSourcePath(sourcePath) {
  const path = sourcePath.endsWith('.txt') ? sourcePath : `${sourcePath}.txt`;
  return parseSections(await loadText(`${RAW_BASE}/${path}`));
}

async function resolveSection(rawSection) {
  const include = rawSection?.trim().match(/^@(.+)$/);
  if (!include) return rawSection;
  const included = await fetchSourcePath(include[1]);
  return included.Lectio || rawSection;
}

async function buildDynamicProper(mapping) {
  const sourcePaths = mapping.sourcePaths || (mapping.sourcePath ? [mapping.sourcePath] : []);
  if (!sourcePaths.length) return null;

  const sections = {};
  for (const sourcePath of sourcePaths) {
    const parsed = await fetchSourcePath(sourcePath);
    for (const [sourceKey, targetKey] of Object.entries(SECTION_MAP)) {
      const raw = await resolveSection(parsed[sourceKey]);
      const normalized = normalizeSection(raw);
      if (normalized) sections[targetKey] = normalized;
    }
  }

  return normalizeProper(mapping.properId || sourcePaths[0], {
    title: mapping.title || '',
    sourcePaths: sourcePaths.map((sourcePath) => `web/www/missa/English/${sourcePath.endsWith('.txt') ? sourcePath : `${sourcePath}.txt`}`),
    sections,
  }, { source: DIVINUM_SOURCE });
}

export async function getPropersForDate(dateKey) {
  try {
    const properMap = await loadJson(PROPER_MAP_URL);
    const mapping = getMapValue(properMap?.days?.[dateKey]);
    if (!mapping?.properId) return null;

    const catalog = await loadJson(PROPERS_CATALOG_URL);
    const proper = catalog?.propers?.[mapping.properId];
    if (proper) return normalizeProper(mapping.properId, proper, catalog);

    return buildDynamicProper(mapping);
  } catch (error) {
    console.warn('Missal propers unavailable.', error);
    return null;
  }
}
