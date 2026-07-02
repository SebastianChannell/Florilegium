#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_LIST = path.join(ROOT, 'tools/missal-propers-source-list.json');
const OUTPUT_DIR = path.join(ROOT, 'data/missal/1962');
const DO_ROOT = process.env.DIVINUM_OFFICIUM_PATH;

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

function requireDoRoot() {
  if (!DO_ROOT) {
    throw new Error('Set DIVINUM_OFFICIUM_PATH to a local clone of DivinumOfficium/divinum-officium before running this script.');
  }
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
    ? { ...(introduction ? { introduction } : {}), ...(references.length ? { references } : {}), text: text.length === 1 ? text[0] : text }
    : null;
}

function formatSection(section) {
  if (!section) return '';
  if (typeof section === 'string') return section;
  const references = Array.isArray(section.references) ? section.references.join('\n') : '';
  const text = Array.isArray(section.text) ? section.text.join('\n') : (section.text || '');
  return [section.introduction, references, text].filter(Boolean).join('\n');
}

function ensureTxt(filePath) {
  return filePath.endsWith('.txt') ? filePath : `${filePath}.txt`;
}

function sourcePath(language, relPath, base = 'missa') {
  return path.join(DO_ROOT, 'web', 'www', base, language, ensureTxt(relPath));
}

async function readSource(language, relPath, base = 'missa', optional = false) {
  try {
    return await readFile(sourcePath(language, relPath, base), 'utf8');
  } catch (error) {
    if (optional && error.code === 'ENOENT') return null;
    throw error;
  }
}

function descriptorForReference(reference) {
  const cleaned = String(reference || '').trim();
  if (!cleaned) return null;
  if (/^C\d+[a-z]*$/i.test(cleaned)) return { path: `Commune/${cleaned}.txt`, base: 'horas' };
  if (/^Commune\//i.test(cleaned)) return { path: ensureTxt(cleaned), base: 'horas' };
  return { path: ensureTxt(cleaned), base: 'missa' };
}

function getCommuneDescriptors(parsed) {
  const source = [parsed.Rank, parsed.Rule].filter(Boolean).join('\n');
  const descriptors = [];
  const seen = new Set();
  const matcher = /(?:^|[;\s])(ex|vide)\s+((?:[a-z\s]+\/)?C\d+[a-z]*|Sancti\/[^;\s]+|Tempora\/[^;\s]+)/gim;
  let match;

  while ((match = matcher.exec(source))) {
    const descriptor = descriptorForReference(match[2]);
    const key = `${descriptor.base}:${descriptor.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      descriptors.push(descriptor);
    }
  }

  return descriptors;
}

function automaticCommemorationDescriptor(itemPath) {
  const normalized = ensureTxt(itemPath);
  if (!/^Sancti\/\d{2}-\d{2}[a-z]*\.txt$/i.test(normalized)) return null;
  return { path: normalized.replace(/\.txt$/i, 'cc.txt'), base: 'missa' };
}

async function parseDescriptor(language, descriptor, optional = false) {
  const text = await readSource(language, descriptor.path, descriptor.base, optional);
  if (!text) return null;
  return { ...descriptor, parsed: parseSections(text), sourcePath: `web/www/${descriptor.base}/${language}/${descriptor.path}` };
}

async function resolveSection(language, sourceKey, rawSection, base = 'missa') {
  const include = rawSection?.trim().match(/^@(.+)$/);
  if (!include) return rawSection;
  const descriptor = descriptorForReference(include[1]);
  const included = await parseDescriptor(language, descriptor, true);
  return included?.parsed?.[sourceKey] || included?.parsed?.Lectio || rawSection;
}

function mergeManualSection(sections, key, value) {
  if (!value) return;
  sections[key] = typeof value === 'string' ? normalizeSection(value) : value;
}

async function buildCommemoration(language, descriptor) {
  const fetched = await parseDescriptor(language, descriptor, true);
  if (!fetched) return null;
  const sections = {};

  for (const [sourceKey, targetKey] of Object.entries(COMMEMORATION_MAP)) {
    const raw = await resolveSection(language, sourceKey, fetched.parsed[sourceKey], fetched.base);
    const normalized = normalizeSection(raw);
    if (normalized) sections[targetKey] = normalized;
  }

  if (!Object.keys(sections).length) return null;
  return { title: fetched.parsed.Officium || fetched.parsed.Rank || '', sections, sourcePath: fetched.sourcePath };
}

function buildCommemorationBlock(commemorations) {
  return commemorations.map((commemoration) => {
    const title = String(commemoration.title || '').trim().replace(/\n+/g, ' ');
    const lines = [];
    if (title) lines.push(`Commemoration: ${title}`);
    if (commemoration.sections.collect) lines.push('Oratio', formatSection(commemoration.sections.collect));
    if (commemoration.sections.secret) lines.push('Secreta', formatSection(commemoration.sections.secret));
    if (commemoration.sections.postcommunion) lines.push('Postcommunio', formatSection(commemoration.sections.postcommunion));
    return lines.filter(Boolean).join('\n');
  }).filter(Boolean).join('\n\n');
}

async function buildProper(language, item) {
  const mainDescriptor = { path: ensureTxt(item.path), base: 'missa' };
  const main = await parseDescriptor(language, mainDescriptor);
  const sources = [];
  const sourcePaths = [];
  const sections = {};

  for (const descriptor of getCommuneDescriptors(main.parsed)) sources.push(descriptor);
  sources.push(mainDescriptor);

  for (const descriptor of sources) {
    const source = descriptor.path === mainDescriptor.path && descriptor.base === mainDescriptor.base
      ? main
      : await parseDescriptor(language, descriptor, true);
    if (!source) continue;
    sourcePaths.push(source.sourcePath);

    for (const [sourceKey, targetKey] of Object.entries(SECTION_MAP)) {
      const raw = await resolveSection(language, sourceKey, source.parsed[sourceKey], source.base);
      const normalized = normalizeSection(raw);
      if (normalized) sections[targetKey] = normalized;
    }
  }

  for (const [targetKey, manualSection] of Object.entries(item.manualSections || {})) {
    mergeManualSection(sections, targetKey, manualSection);
  }

  const commemorationDescriptors = [];
  for (const relPath of item.commemorationSourcePaths || []) commemorationDescriptors.push(descriptorForReference(relPath));
  const automatic = automaticCommemorationDescriptor(item.path);
  if (automatic) commemorationDescriptors.push(automatic);

  const commemorations = [];
  for (const descriptor of commemorationDescriptors.filter(Boolean)) {
    const commemoration = await buildCommemoration(language, descriptor);
    if (commemoration) commemorations.push(commemoration);
  }
  const commemorationBlock = buildCommemorationBlock(commemorations);
  if (commemorationBlock) sections.commemorations = commemorationBlock;

  return {
    title: item.title || main.parsed.Officium || main.parsed.Rank?.split(';;')?.[0] || '',
    sourcePaths: Array.from(new Set([...sourcePaths, ...commemorations.map((item) => item.sourcePath)])),
    rank: main.parsed.Rank?.split(';;')?.[1] || undefined,
    rule: main.parsed.Rule?.split('\n').filter(Boolean) || undefined,
    sections,
  };
}

async function build() {
  requireDoRoot();
  const sourceList = JSON.parse(await readFile(SOURCE_LIST, 'utf8'));
  const language = sourceList.language || 'English';
  const propers = {};
  const days = {};

  for (const item of sourceList.items) {
    propers[item.properId] = await buildProper(language, item);
    for (const date of item.mapDates || []) days[date] = item.properId;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, 'propers-en.json'), `${JSON.stringify({
    version: '1962',
    language,
    source: {
      name: 'Divinum Officium',
      repository: 'https://github.com/DivinumOfficium/divinum-officium',
      license: 'MIT',
      notice: 'Divinum Officium data files are MIT licensed. Include the permission notice when distributing substantial portions.',
    },
    propers,
  }, null, 2)}\n`);
  await writeFile(path.join(OUTPUT_DIR, 'proper-map-2026.generated.json'), `${JSON.stringify({ year: 2026, days }, null, 2)}\n`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
