#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCES = [
  { file: 'content/miniature-lives/vol-i.md', volume: 'I', source: 'Miniature Lives of the Saints, Vol. I' },
  { file: 'content/miniature-lives/vol-ii.md', volume: 'II', source: 'Miniature Lives of the Saints, Vol. II' },
];
const OUT = path.join(ROOT, 'data/miniature-lives/entries.json');
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_TO_NUMBER = Object.fromEntries(MONTHS.map((m, i) => [m, String(i + 1).padStart(2, '0')]));
const dailyHeading = new RegExp(`^##\\s+(${MONTHS.join('|')})\\s+(\\d{1,2})\\s+[—-]\\s+(.+?)\\s*$`);
const anyH2 = /^##\s+/;
const h3 = /^###\s+(.+?)\s*$/;

function stripFrontmatter(text) {
  return text.replace(/^---[\s\S]*?---\s*/, '');
}

function paragraphs(text) {
  return text
    .split(/\n\s*\n+/)
    .map((part) => part.replace(/\n/g, ' ').replace(/^>\s?/, '').trim())
    .filter(Boolean);
}

function parseEntry(lines, start, meta, warnings) {
  const match = lines[start].match(dailyHeading);
  const [, month, dayText, saint] = match;
  const day = Number(dayText);
  const dateKey = `${MONTH_TO_NUMBER[month]}-${String(day).padStart(2, '0')}`;
  let end = start + 1;
  while (end < lines.length && !dailyHeading.test(lines[end])) end += 1;
  const chunk = lines.slice(start + 1, end);
  const virtueLine = chunk.find((line) => /^\*\*Virtue:\*\*/i.test(line.trim()));
  const virtue = virtueLine ? virtueLine.replace(/^\*\*Virtue:\*\*\s*/i, '').trim() : '';
  const lifeIndex = chunk.findIndex((line) => /^###\s+Life\s*$/i.test(line.trim()));
  if (lifeIndex === -1) warnings.push(`${meta.file}: ${dateKey} missing Life heading`);
  let devotionIndex = -1;
  if (lifeIndex !== -1) {
    devotionIndex = chunk.findIndex((line, index) => index > lifeIndex && h3.test(line.trim()) && !/^###\s+Life\s*$/i.test(line.trim()));
  }
  if (devotionIndex === -1) warnings.push(`${meta.file}: ${dateKey} missing devotion heading`);
  if (!virtue) warnings.push(`${meta.file}: ${dateKey} missing virtue`);
  const lifeText = lifeIndex === -1 ? '' : chunk.slice(lifeIndex + 1, devotionIndex === -1 ? chunk.length : devotionIndex).join('\n').trim();
  const devotionTitle = devotionIndex === -1 ? '' : chunk[devotionIndex].replace(/^###\s+/, '').trim();
  const devotionText = devotionIndex === -1 ? '' : chunk.slice(devotionIndex + 1).join('\n').trim();
  const life = paragraphs(lifeText);
  const devotionSections = paragraphs(devotionText);
  if (!life.length) warnings.push(`${meta.file}: ${dateKey} has empty life section`);
  if (!devotionSections.length) warnings.push(`${meta.file}: ${dateKey} has empty devotion section`);
  return [{ dateKey, month, day, saint: saint.trim(), virtue, life, devotionTitle, devotionSections, volume: meta.volume, source: meta.source }, end];
}

function parseSource(meta) {
  const warnings = [];
  const full = stripFrontmatter(fs.readFileSync(path.join(ROOT, meta.file), 'utf8'));
  const startMarker = full.search(/^#\s+Lives and Devotions\s*$/m);
  if (startMarker === -1) throw new Error(`${meta.file}: missing # Lives and Devotions`);
  let body = full.slice(startMarker);
  const supplement = body.search(/^#\s+Supplementary Lives\s*$/m);
  if (supplement !== -1) body = body.slice(0, supplement);
  const lines = body.split(/\r?\n/);
  const entries = [];
  for (let i = 0; i < lines.length;) {
    if (dailyHeading.test(lines[i])) {
      const [entry, next] = parseEntry(lines, i, meta, warnings);
      entries.push(entry);
      i = next;
    } else {
      if (anyH2.test(lines[i]) && /\|/.test(lines[i])) warnings.push(`${meta.file}: possible table heading skipped at line ${i + 1}`);
      i += 1;
    }
  }
  return { entries, warnings };
}

const all = [];
const seen = new Map();
const warnings = [];
for (const source of SOURCES) {
  const result = parseSource(source);
  warnings.push(...result.warnings);
  for (const entry of result.entries) {
    if (seen.has(entry.dateKey)) {
      warnings.push(`Duplicate dateKey ${entry.dateKey} in ${source.file}; keeping ${seen.get(entry.dateKey)}`);
      continue;
    }
    seen.set(entry.dateKey, source.file);
    all.push(entry);
  }
}
all.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(all, null, 2)}\n`);
console.log(`Built ${all.length} Miniature Lives entries at ${path.relative(ROOT, OUT)}`);
if (warnings.length) {
  console.warn(`Warnings (${warnings.length}):`);
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}
