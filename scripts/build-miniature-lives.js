#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCES = [
  { file: 'content/miniature-lives/vol-i.md', volume: 'I', source: 'Miniature Lives of the Saints, Vol. I' },
  { file: 'content/miniature-lives/vol-ii.md', volume: 'II', source: 'Miniature Lives of the Saints, Vol. II' },
];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_INDEX = new Map(MONTHS.map((m, i) => [m, i + 1]));
const DAILY_HEADING = new RegExp(`^##\\s+(${MONTHS.join('|')})\\s+(\\d{1,2})\\s+[—-]\\s+(.+)\\s*$`);
const SECTION_HEADING = /^###\s+(.+?)\s*$/;

function stripFrontmatter(text) {
  return text.replace(/^---[\s\S]*?---\s*/, '');
}

function dateKey(month, day) {
  return `${String(MONTH_INDEX.get(month)).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function cleanParagraph(line) {
  return line.replace(/^>\s?/, '').trim();
}

function splitParagraphs(lines) {
  return lines.join('\n').split(/\n\s*\n+/).map((p) => p.split('\n').map(cleanParagraph).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function parseEntry(lines, meta, warnings) {
  const heading = lines[0].match(DAILY_HEADING);
  if (!heading) return null;
  const [, month, rawDay, saint] = heading;
  const day = Number(rawDay);
  const key = dateKey(month, day);
  const virtueLine = lines.find((line) => /^\*\*Virtue:\*\*/i.test(line.trim()));
  const virtue = virtueLine ? virtueLine.replace(/^\*\*Virtue:\*\*\s*/i, '').trim() : '';

  const lifeIndex = lines.findIndex((line) => /^###\s+Life\s*$/i.test(line.trim()));
  if (lifeIndex < 0) warnings.push(`${meta.file}: ${key} missing Life section`);
  let devotionIndex = -1;
  if (lifeIndex >= 0) {
    devotionIndex = lines.findIndex((line, i) => i > lifeIndex && SECTION_HEADING.test(line.trim()));
  }
  if (devotionIndex < 0) warnings.push(`${meta.file}: ${key} missing devotion section`);

  const lifeLines = lifeIndex >= 0 ? lines.slice(lifeIndex + 1, devotionIndex >= 0 ? devotionIndex : lines.length) : [];
  const devotionTitle = devotionIndex >= 0 ? lines[devotionIndex].replace(/^###\s+/, '').trim() : '';
  const devotionLines = devotionIndex >= 0 ? lines.slice(devotionIndex + 1) : [];
  const life = splitParagraphs(lifeLines);
  const devotionSections = splitParagraphs(devotionLines);
  if (!life.length) warnings.push(`${meta.file}: ${key} has empty life body`);
  if (!devotionSections.length) warnings.push(`${meta.file}: ${key} has empty devotion body`);

  return { dateKey: key, month, day, saint: saint.trim(), virtue, life, devotionTitle, devotionSections, volume: meta.volume, source: meta.source };
}

function parseFile(meta, warnings) {
  const full = path.join(ROOT, meta.file);
  const text = stripFrontmatter(fs.readFileSync(full, 'utf8'));
  const marker = text.search(/^#\s+Lives and Devotions\s*$/m);
  if (marker < 0) throw new Error(`${meta.file}: missing # Lives and Devotions`);
  const dailyText = text.slice(marker);
  const supplementAt = dailyText.search(/^#\s+Supplementary Lives\s*$/m);
  const calendarText = supplementAt >= 0 ? dailyText.slice(0, supplementAt) : dailyText;
  const lines = calendarText.split(/\r?\n/);
  const entries = [];
  let current = null;
  for (const line of lines) {
    if (DAILY_HEADING.test(line)) {
      if (current) entries.push(parseEntry(current, meta, warnings));
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) entries.push(parseEntry(current, meta, warnings));
  return entries.filter(Boolean);
}

function build() {
  const warnings = [];
  const byDate = new Map();
  const entries = [];
  for (const source of SOURCES) {
    for (const entry of parseFile(source, warnings)) {
      if (byDate.has(entry.dateKey)) {
        warnings.push(`${source.file}: duplicate ${entry.dateKey} ignored; kept ${byDate.get(entry.dateKey).saint}`);
        continue;
      }
      byDate.set(entry.dateKey, entry);
      entries.push(entry);
    }
  }
  entries.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const out = path.join(ROOT, 'data/miniature-lives.json');
  fs.writeFileSync(out, `${JSON.stringify(entries, null, 2)}\n`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
  console.log(`Wrote ${path.relative(ROOT, out)} (${entries.length} entries)`);
  return { entries, warnings };
}

if (require.main === module) build();
module.exports = { build, parseFile, dateKey };
