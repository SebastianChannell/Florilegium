#!/usr/bin/env node
const assert = require('assert');
const { execFileSync } = require('child_process');
execFileSync(process.execPath, ['scripts/build-miniature-lives.js'], { stdio: 'pipe' });
const entries = require('../data/miniature-lives/entries.json');
const byDate = new Map(entries.map((entry) => [entry.dateKey, entry]));
assert.strictEqual(byDate.size, entries.length, 'dateKeys should be unique');
assert.match(byDate.get('01-01')?.dateKey || '', /^\d{2}-\d{2}$/);
assert.strictEqual(byDate.get('01-01')?.saint, 'S. Fulgentius, Bishop.');
assert.strictEqual(byDate.get('01-28')?.saint, 'S. Cyril of Alexandria.');
assert.strictEqual(byDate.get('07-01')?.saint, 'S. Isidore of Madrid.');
const scanGap = entries.find((entry) =>
  entry.life.concat(entry.devotionSections).some((paragraph) => /missing from the uploaded scan/i.test(paragraph))
);
assert.ok(scanGap, 'scan-gap placeholder entries should parse without crashing');
entries.forEach((entry) => assert.match(entry.dateKey, /^(0[1-9]|1[0-2])-([0-2][0-9]|3[01])$/));
console.log(`Validated ${entries.length} Miniature Lives entries.`);
