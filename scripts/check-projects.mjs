import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const projectFile = new URL("../projects.json", import.meta.url);
const payload = JSON.parse(await readFile(projectFile, "utf8"));

assert.ok(payload && Array.isArray(payload.projects), "projects.json must contain a projects array");
assert.ok(payload.projects.length > 0, "Domus must contain at least one project");

const ids = new Set();
const urls = new Set();

for (const [index, project] of payload.projects.entries()) {
  const position = `projects[${index}]`;
  assert.ok(project && typeof project === "object", `${position} must be an object`);

  for (const field of ["id", "title", "label", "url"]) {
    assert.equal(typeof project[field], "string", `${position}.${field} must be a string`);
    assert.ok(project[field].trim(), `${position}.${field} must not be empty`);
  }

  assert.match(project.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${position}.id must use lowercase kebab-case`);
  assert.ok(!ids.has(project.id), `${position}.id must be unique`);
  ids.add(project.id);

  const url = new URL(project.url);
  assert.equal(url.protocol, "https:", `${position}.url must use HTTPS`);
  assert.ok(!urls.has(url.href), `${position}.url must be unique`);
  urls.add(url.href);
}

console.log(`Validated ${payload.projects.length} Domus projects.`);
