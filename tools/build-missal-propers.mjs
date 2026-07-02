#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_LIST = path.join(ROOT, 'tools/missal-propers-source-list.json');
const OUTPUT_DIR = path.join(ROOT, 'data/missal/1962');
const DO_ROOT = process.env.DIVINUM_OFFICIUM_PATH;

const DEFAULT_VERSION = 'Rubrics 1960 - 1960';
const DEFAULT_DIOECESIS = 'Generale';
const DEFAULT_VOTIVE = 'Hodie';

const HEADING_MAP = new Map([
  ['introitus', 'introit'],
  ['introit', 'introit'],
  ['oratio', 'collect'],
  ['collect', 'collect'],
  ['lectio', 'epistle'],
  ['lesson', 'epistle'],
  ['epistle', 'epistle'],
  ['graduale', 'gradual'],
  ['gradual', 'gradual'],
  ['alleluia', 'alleluia'],
  ['tractus', 'tract'],
  ['tract', 'tract'],
  ['evangelium', 'gospel'],
  ['gospel', 'gospel'],
  ['offertorium', 'offertory'],
  ['offertory', 'offertory'],
  ['secreta', 'secret'],
  ['secret', 'secret'],
  ['prefatio', 'preface'],
  ['preface', 'preface'],
  ['communio', 'communion'],
  ['communion', 'communion'],
  ['postcommunio', 'postcommunion'],
  ['postcommunion', 'postcommunion'],
  ['commemoratio', 'commemorations'],
  ['commemoration', 'commemorations'],
]);

const NON_PROPER_HEADINGS = new Set([
  'gloria',
  'credo',
]);

const SCRIPTURE_BOOKS = [
  'Abd', 'Agg', 'Amos', 'Apoc', 'Bar', 'Cant', 'Col', 'Cor', 'Dan', 'Deut', 'Eccli', 'Ecclus', 'Eph',
  'Exod', 'Ezech', 'Gal', 'Gen', 'Hab', 'Heb', 'Isa', 'Jac', 'Jer', 'Joel', 'John', 'Jonas', 'Jos', 'Jude',
  'Judg', 'Kings', 'Lam', 'Lev', 'Luke', 'Lk', 'Mach', 'Mal', 'Mark', 'Matt', 'Mich', 'Num', 'Par', 'Pet',
  'Phil', 'Prov', 'Ps', 'Rom', 'Sir', 'Song', 'Soph', 'Thess', 'Tim', 'Titus', 'Tob', 'Wis', 'Zach', 'Zeph',
];
const REFERENCE_RE = new RegExp(`^(?:[1-4]\\s*)?(?:${SCRIPTURE_BOOKS.join('|')})\\.?\\s+\\d`, 'i');

function requireDoRoot() {
  if (!DO_ROOT) {
    throw new Error('Set DIVINUM_OFFICIUM_PATH to a local clone of DivinumOfficium/divinum-officium before running this script.');
  }
}

function toDoDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) throw new Error(`Invalid date key: ${dateKey}`);
  return `${month}-${day}-${year}`;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}\n${stderr}`));
    });
  });
}

async function renderDivinumMissa(dateKey, item, language) {
  const missaScript = path.join(DO_ROOT, 'web', 'cgi-bin', 'missa', 'missa.pl');
  const date = toDoDate(dateKey);
  const params = new URLSearchParams({
    date,
    date1: date,
    command: 'praySanctaMissa',
    version: item.version || DEFAULT_VERSION,
    lang1: item.lang1 || language,
    lang2: item.lang2 || language,
    langfb: item.langfb || language,
    dioecesis: item.dioecesis || DEFAULT_DIOECESIS,
    votive: item.votive || DEFAULT_VOTIVE,
    Propers: '1',
    content: '1',
    rubrics: '1',
    solemn: item.solemn ? '1' : '0',
  });

  const { stdout } = await runCommand('perl', [missaScript], {
    cwd: path.dirname(missaScript),
    env: {
      ...process.env,
      REQUEST_METHOD: 'GET',
      QUERY_STRING: params.toString(),
      SCRIPT_NAME: '/cgi-bin/missa/missa.pl',
      SERVER_NAME: 'localhost',
      SERVER_PORT: '80',
      GATEWAY_INTERFACE: 'CGI/1.1',
      SERVER_PROTOCOL: 'HTTP/1.1',
    },
  });

  if (!stdout.includes('<TABLE') && !stdout.includes('Sancta Missa')) {
    throw new Error(`Divinum Officium returned unexpected output for ${dateKey}.`);
  }

  return stdout;
}

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    ensp: ' ',
    emsp: ' ',
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function htmlToLines(html) {
  return decodeHtmlEntities(html)
    .replace(/\r\n/g, '\n')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|h\d|tr|td|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !/^Content-type:/i.test(line))
    .filter((line) => !/^Set-Cookie:/i.test(line))
    .filter((line) => !/^(Top|Next|Top Next)$/i.test(line))
    .filter((line) => !/^\d+$/.test(line));
}

function normalizeHeading(line) {
  return String(line || '')
    .replace(/[{}]/g, '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/[:.]+$/g, '')
    .trim()
    .toLowerCase();
}

function renderedLineToSectionKey(line) {
  const normalized = normalizeHeading(line);
  if (HEADING_MAP.has(normalized)) return HEADING_MAP.get(normalized);
  if (NON_PROPER_HEADINGS.has(normalized)) return null;
  return undefined;
}

function cleanRenderedLine(line) {
  return String(line || '')
    .replace(/^℣\./, 'V.')
    .replace(/^℟\./, 'R.')
    .replace(/^v\.\s*/i, '')
    .replace(/^r\.\s*/i, 'R. ')
    .replace(/^s\.\s*/i, 'S. ')
    .replace(/^p\.\s*/i, 'P. ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldSkipRenderedLine(line) {
  return /^(Sancta Missa|Sancta Missa Persoluta|Rubrics|Solemn|Compare|Divinum Officium|Options|Ordo|Kalendarium|Propers|Full)$/i.test(line)
    || /^The Lord be with you\.?$/i.test(line)
    || /^And with (thy|your) spirit\.?$/i.test(line)
    || /^Let us pray\.?$/i.test(line)
    || /^Praise be to thee,? O Christ\.?$/i.test(line)
    || /^R\. Praise be to thee,? O Christ\.?$/i.test(line)
    || /^Amen\.?$/i.test(line);
}

function normalizeRenderedSection(lines) {
  const references = [];
  const text = [];
  let introduction = '';

  for (const rawLine of lines) {
    const line = cleanRenderedLine(rawLine);
    if (!line || shouldSkipRenderedLine(line)) continue;

    if (!introduction && /^(Reading|A reading|Lesson|Continuation)/i.test(line)) {
      introduction = line;
      continue;
    }

    if (REFERENCE_RE.test(line) || /^(Sedulius|Tract|Alleluia)$/i.test(line)) {
      references.push(line.replace(/\.$/, ''));
      continue;
    }

    text.push(line);
  }

  if (!introduction && !references.length && !text.length) return null;
  return {
    ...(introduction ? { introduction } : {}),
    ...(references.length ? { references: Array.from(new Set(references)) } : {}),
    text: text.length === 1 ? text[0] : text,
  };
}

function parseRenderedPropers(html) {
  const lines = htmlToLines(html);
  const rawSections = {};
  let currentKey = null;

  for (const line of lines) {
    const sectionKey = renderedLineToSectionKey(line);
    if (sectionKey === null) {
      currentKey = null;
      continue;
    }
    if (sectionKey) {
      currentKey = sectionKey;
      rawSections[currentKey] ||= [];
      continue;
    }
    if (currentKey) rawSections[currentKey].push(line);
  }

  const sections = {};
  for (const [key, value] of Object.entries(rawSections)) {
    const normalized = normalizeRenderedSection(value);
    if (normalized) sections[key] = normalized;
  }

  return sections;
}

function getPrimaryDate(item) {
  const date = item.generateFromDate || item.mapDates?.[0];
  if (!date) throw new Error(`Missing mapDates/generateFromDate for ${item.properId}`);
  return date;
}

async function buildProper(language, item) {
  const renderedHtml = await renderDivinumMissa(getPrimaryDate(item), item, language);
  const sections = parseRenderedPropers(renderedHtml);

  if (!sections.collect && !sections.gospel && !sections.epistle) {
    throw new Error(`Could not parse rendered propers for ${item.properId}. Try running with the same DIVINUM_OFFICIUM_PATH manually and inspect the rendered HTML.`);
  }

  return {
    title: item.title || '',
    generatedFromDate: getPrimaryDate(item),
    sourcePaths: ['rendered by local Divinum Officium CGI: web/cgi-bin/missa/missa.pl?Propers=1'],
    version: item.version || DEFAULT_VERSION,
    dioecesis: item.dioecesis || DEFAULT_DIOECESIS,
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
    generatedBy: 'tools/build-missal-propers.mjs',
    source: {
      name: 'Divinum Officium',
      repository: 'https://github.com/DivinumOfficium/divinum-officium',
      license: 'MIT',
      notice: 'Generated from a local Divinum Officium checkout. Divinum Officium data files are MIT licensed. Include the permission notice when distributing substantial portions.',
    },
    propers,
  }, null, 2)}\n`);
  await writeFile(path.join(OUTPUT_DIR, 'proper-map-2026.generated.json'), `${JSON.stringify({ year: 2026, days }, null, 2)}\n`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
