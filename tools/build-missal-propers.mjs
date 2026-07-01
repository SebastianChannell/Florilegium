#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_LIST = path.join(ROOT, 'tools/missal-propers-source-list.json');
const OUTPUT_DIR = path.join(ROOT, 'data/missal/1962');
const RAW_BASE = 'https://raw.githubusercontent.com/DivinumOfficium/divinum-officium/master/web/www/missa';

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

function parseSections(text) {
  const sections = {};
  let current = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
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
  return line
    .replace(/^v\.\s*/i, '')
    .replace(/^V\.\s*/g, 'V. ')
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
    if (!introduction && /^(Reading|Continuation|Lesson)/i.test(line)) {
      introduction = line;
      continue;
    }
    text.push(line);
  }

  return { introduction, references, text }.references?.length || introduction || text.length
    ? { ...(introduction ? { introduction } : {}), ...(references.length ? { references } : {}), text }
    : null;
}

async function fetchRaw(language, relPath) {
  const url = `${RAW_BASE}/${language}/${relPath}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function resolveSection(language, rawSection) {
  const include = rawSection?.trim().match(/^@(.+)$/);
  if (!include) return rawSection;
  const includePath = include[1].endsWith('.txt') ? include[1] : `${include[1]}.txt`;
  const included = parseSections(await fetchRaw(language, includePath));
  return included.Lectio || rawSection;
}

async function build() {
  const sourceList = JSON.parse(await readFile(SOURCE_LIST, 'utf8'));
  const language = sourceList.language || 'English';
  const propers = {};
  const days = {};

  for (const item of sourceList.items) {
    const raw = await fetchRaw(language, item.path);
    const parsed = parseSections(raw);
    const sections = {};

    for (const [sourceKey, targetKey] of Object.entries(SECTION_MAP)) {
      const rawSection = await resolveSection(language, parsed[sourceKey]);
      const normalized = normalizeSection(rawSection);
      if (normalized) sections[targetKey] = normalized;
    }

    propers[item.properId] = {
      title: item.title,
      sourcePaths: [`web/www/missa/${language}/${item.path}`],
      sections,
    };

    for (const date of item.mapDates || []) days[date] = item.properId;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, 'propers-en.generated.json'), `${JSON.stringify({ version: '1962', language, source: { name: 'Divinum Officium', repository: 'https://github.com/DivinumOfficium/divinum-officium', license: 'MIT' }, propers }, null, 2)}\n`);
  await writeFile(path.join(OUTPUT_DIR, 'proper-map-2026.generated.json'), `${JSON.stringify({ year: 2026, days }, null, 2)}\n`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
