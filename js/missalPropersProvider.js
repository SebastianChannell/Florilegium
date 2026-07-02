const PROPERS_CATALOG_URL = '/data/missal/1962/propers-en.json';
const PROPER_MAP_URL = '/data/missal/1962/proper-map-2026.json';
const MISSA_BASE = 'https://raw.githubusercontent.com/DivinumOfficium/divinum-officium/master/web/www/missa/English';
const HORAS_BASE = 'https://raw.githubusercontent.com/DivinumOfficium/divinum-officium/master/web/www/horas/English';

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

const COMMEMORATION_MAP = {
  Oratio: 'collect',
  Secreta: 'secret',
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

async function loadText(url, options = {}) {
  if (cache.has(url)) return cache.get(url);
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) {
    if (options.optional) return null;
    throw new Error(`Unable to load ${url}`);
  }
  const text = await response.text();
  cache.set(url, text);
  return text;
}

function parseSections(text) {
  const sections = {};
  let current = null;
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const heading = line.match(/^\[([^\]]+)\](?:\s*\(([^)]*)\))?$/);
    if (heading) {
      const qualifier = heading[2] || '';
      current = qualifier && !/ad missam/i.test(qualifier) ? `${heading[1]} (${qualifier})` : heading[1];
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

function ensureTxt(path) {
  return path.endsWith('.txt') ? path : `${path}.txt`;
}

function sourceDescriptor(path, base = 'missa') {
  const normalizedPath = ensureTxt(path);
  const prefix = base === 'horas' ? 'web/www/horas/English' : 'web/www/missa/English';
  return {
    path: normalizedPath,
    base,
    url: `${base === 'horas' ? HORAS_BASE : MISSA_BASE}/${normalizedPath}`,
    sourcePath: `${prefix}/${normalizedPath}`,
  };
}

function descriptorForReference(reference, preferredBase = 'missa') {
  const cleaned = String(reference || '').trim();
  if (!cleaned) return null;
  if (/^C\d+[a-z]*$/i.test(cleaned)) return sourceDescriptor(`Commune/${cleaned}`, 'horas');
  if (/^Commune\//i.test(cleaned)) return sourceDescriptor(cleaned, 'horas');
  return sourceDescriptor(cleaned, preferredBase);
}

function getCommuneDescriptors(parsed) {
  const source = [parsed.Rank, parsed.Rule].filter(Boolean).join('\n');
  const descriptors = [];
  const seen = new Set();
  const matcher = /(?:^|[;\s])(ex|vide)\s+((?:[a-z\s]+\/)?C\d+[a-z]*|Sancti\/[^;\s]+|Tempora\/[^;\s]+)/gim;
  let match;

  while ((match = matcher.exec(source))) {
    const descriptor = descriptorForReference(match[2]);
    if (descriptor && !seen.has(descriptor.sourcePath)) {
      seen.add(descriptor.sourcePath);
      descriptors.push(descriptor);
    }
  }

  return descriptors;
}

function getAutomaticCommemorationDescriptor(sourcePath) {
  const path = ensureTxt(String(sourcePath || ''));
  if (!/^Sancti\/\d{2}-\d{2}[a-z]*\.txt$/i.test(path)) return null;
  return sourceDescriptor(path.replace(/\.txt$/i, 'cc.txt'), 'missa');
}

async function fetchDescriptor(descriptor, options = {}) {
  const text = await loadText(descriptor.url, options);
  if (!text) return null;
  return { ...descriptor, parsed: parseSections(text) };
}

async function fetchSourcePath(sourcePath, options = {}) {
  const descriptor = typeof sourcePath === 'string' ? descriptorForReference(sourcePath) : sourcePath;
  if (!descriptor) return null;
  return fetchDescriptor(descriptor, options);
}

async function resolveSection(sourceKey, rawSection, preferredBase = 'missa') {
  const include = rawSection?.trim().match(/^@(.+)$/);
  if (!include) return rawSection;
  const included = await fetchSourcePath(descriptorForReference(include[1], preferredBase), { optional: true });
  return included?.parsed?.[sourceKey] || included?.parsed?.Lectio || rawSection;
}

function addSourceDescriptor(list, descriptor) {
  if (!descriptor || list.some((item) => item.sourcePath === descriptor.sourcePath)) return;
  list.push(descriptor);
}

function formatCommemorationTitle(title) {
  return String(title || '').trim().replace(/\n+/g, ' ');
}

function buildCommemorationBlock(commemorations) {
  return commemorations.map((commemoration) => {
    const lines = [];
    const title = formatCommemorationTitle(commemoration.title);
    if (title) lines.push(`Commemoration: ${title}`);
    if (commemoration.sections.collect) lines.push('Oratio', formatSection(commemoration.sections.collect));
    if (commemoration.sections.secret) lines.push('Secreta', formatSection(commemoration.sections.secret));
    if (commemoration.sections.postcommunion) lines.push('Postcommunio', formatSection(commemoration.sections.postcommunion));
    return lines.filter(Boolean).join('\n');
  }).filter(Boolean).join('\n\n');
}

async function buildCommemoration(descriptor) {
  const fetched = await fetchDescriptor(descriptor, { optional: true });
  if (!fetched) return null;
  const sections = {};

  for (const [sourceKey, targetKey] of Object.entries(COMMEMORATION_MAP)) {
    const raw = await resolveSection(sourceKey, fetched.parsed[sourceKey], fetched.base);
    const normalized = normalizeSection(raw);
    if (normalized) sections[targetKey] = normalized;
  }

  return Object.keys(sections).length
    ? { title: fetched.parsed.Officium || fetched.parsed.Rank || '', sections, sourcePath: fetched.sourcePath }
    : null;
}

async function buildDynamicProper(mapping) {
  const sourcePaths = mapping.sourcePaths || (mapping.sourcePath ? [mapping.sourcePath] : []);
  if (!sourcePaths.length) return null;

  const fetchedMainSources = [];
  const allSources = [];

  for (const sourcePath of sourcePaths) {
    const fetched = await fetchSourcePath(sourcePath);
    if (!fetched) continue;
    fetchedMainSources.push(fetched);
    for (const descriptor of getCommuneDescriptors(fetched.parsed)) addSourceDescriptor(allSources, descriptor);
    addSourceDescriptor(allSources, fetched);
  }

  const sections = {};
  const sourcePathNotes = [];
  const fetchedSources = [];

  for (const descriptor of allSources) {
    const fetched = descriptor.parsed ? descriptor : await fetchDescriptor(descriptor, { optional: true });
    if (!fetched) continue;
    fetchedSources.push(fetched);
    sourcePathNotes.push(fetched.sourcePath);

    for (const [sourceKey, targetKey] of Object.entries(SECTION_MAP)) {
      const raw = await resolveSection(sourceKey, fetched.parsed[sourceKey], fetched.base);
      const normalized = normalizeSection(raw);
      if (normalized) sections[targetKey] = normalized;
    }
  }

  const commemorationDescriptors = [];
  for (const sourcePath of mapping.commemorationSourcePaths || []) {
    addSourceDescriptor(commemorationDescriptors, descriptorForReference(sourcePath));
  }
  for (const sourcePath of sourcePaths) {
    addSourceDescriptor(commemorationDescriptors, getAutomaticCommemorationDescriptor(sourcePath));
  }

  const commemorations = [];
  for (const descriptor of commemorationDescriptors) {
    const commemoration = await buildCommemoration(descriptor);
    if (commemoration) commemorations.push(commemoration);
  }
  const commemorationBlock = buildCommemorationBlock(commemorations);
  if (commemorationBlock) sections.commemorations = commemorationBlock;

  const primarySource = fetchedMainSources[0]?.parsed || fetchedSources.at(-1)?.parsed || {};

  return normalizeProper(mapping.properId || sourcePaths[0], {
    title: mapping.title || primarySource.Officium || primarySource.Rank?.split(';;')?.[0] || '',
    sourcePaths: Array.from(new Set([...sourcePathNotes, ...commemorations.map((item) => item.sourcePath)])),
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
