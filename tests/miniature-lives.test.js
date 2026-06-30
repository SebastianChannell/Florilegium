const assert = require('assert');
const fs = require('fs');
const { build } = require('../scripts/build-miniature-lives');

const { entries } = build();
const byKey = new Map(entries.map((entry) => [entry.dateKey, entry]));

assert.match(byKey.get('01-01').dateKey, /^\d{2}-\d{2}$/);
assert.strictEqual(byKey.get('01-01').saint, 'S. Fulgentius, Bishop.');
assert.strictEqual(byKey.get('01-01').virtue, 'Patience through Faith.');
assert.notStrictEqual(byKey.get('01-01').saint, 'Supplementary duplicate that must not overwrite.');
assert.strictEqual(byKey.get('07-01').saint, 'B. Giovanni Colombini.');
assert.ok(byKey.get('07-02').life[0].includes('missing from the uploaded scan'));
assert.ok(byKey.get('07-02').devotionSections[0].includes('missing from the uploaded scan'));
assert.ok(fs.existsSync('data/miniature-lives.json'));
console.log('miniature lives parser tests passed');
