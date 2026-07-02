const PROPERS_CATALOG_URL = '/data/missal/1962/propers-en.json';
const PROPER_MAP_URL = '/data/missal/1962/proper-map-2026.json';

const cache = new Map();

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

export async function getPropersForDate(dateKey) {
  try {
    const properMap = await loadJson(PROPER_MAP_URL);
    const mapping = getMapValue(properMap?.days?.[dateKey]);
    if (!mapping?.properId) return null;

    const catalog = await loadJson(PROPERS_CATALOG_URL);
    const proper = catalog?.propers?.[mapping.properId];
    if (!proper) {
      console.warn(`No materialized propers found for ${dateKey} (${mapping.properId}).`);
      return null;
    }

    return normalizeProper(mapping.properId, proper, catalog);
  } catch (error) {
    console.warn('Missal propers unavailable.', error);
    return null;
  }
}
