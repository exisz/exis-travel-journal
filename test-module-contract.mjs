import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, app, moduleSource, sdk] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./app.js", import.meta.url), "utf8"),
  readFile(new URL("./module.js", import.meta.url), "utf8"),
  readFile(new URL("./world-bootstrap.js", import.meta.url), "utf8"),
]);

assert.match(html, /<script src="world-bootstrap\.js\?v=/);
assert.match(html, /<script src="module\.js\?v=/);
assert.match(app, /data-world-kind="trip"/);
assert.match(app, /data-world-kind="day"/);
assert.match(moduleSource, /window\.WorldModuleSdk/);
assert.match(moduleSource, /world\.connect\(\)/);
assert.match(moduleSource, /world\.makeReferenceDraggable/);
assert.match(moduleSource, /world\.addReference/);
assert.match(moduleSource, /type: "travel\.trip"/);
assert.match(moduleSource, /type: "travel\.day"/);
assert.match(sdk, /WORLD_MODULE_REFERENCE_MIME/);
assert.doesNotMatch(moduleSource, /password|token|cookie/i);

console.log("Travel Journal World module contract passed");
