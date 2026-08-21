import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, app, trips, moduleSource, bootstrap, sdk, protocol] = await Promise.all([
  readFile(new URL("./index.html", import.meta.url), "utf8"),
  readFile(new URL("./app.js", import.meta.url), "utf8"),
  readFile(new URL("./trips.js", import.meta.url), "utf8"),
  readFile(new URL("./module.js", import.meta.url), "utf8"),
  readFile(new URL("./world-bootstrap.js", import.meta.url), "utf8"),
  readFile(new URL("./world-sdk/index.js", import.meta.url), "utf8"),
  readFile(new URL("./world-sdk/protocol.js", import.meta.url), "utf8"),
]);

assert.match(html, /<script src="world-bootstrap\.js\?v=/);
assert.match(html, /<script type="module" src="module\.js\?v=/);
assert.ok(html.indexOf("world-bootstrap.js") < html.indexOf("trips.js"), "World bootstrap must load before the application");
assert.match(app, /data-world-kind="trip"/);
assert.match(app, /data-world-kind="day"/);
assert.match(app, /travel:rendered/);
assert.match(moduleSource, /window\.WorldModuleSdk/);
assert.match(moduleSource, /travelWorld\.connect\(\)/);
assert.match(moduleSource, /travelWorld\.makeReferenceDraggable/);
assert.match(moduleSource, /travelWorld\.addReference/);
assert.match(moduleSource, /type: "travel\.trip"/);
assert.match(moduleSource, /type: "travel\.day"/);
assert.match(bootstrap, /WORLD_MODULE_PROTOCOL_VERSION = 1/);
assert.match(bootstrap, /world\.module\.ready/);
assert.match(bootstrap, /WORLD_MODULE_REFERENCE_MIME/);
assert.match(bootstrap, /crypto\.getRandomValues/);
assert.doesNotMatch(bootstrap, /crypto\.randomUUID/);
assert.match(sdk, /WORLD_MODULE_REFERENCE_MIME/);
assert.match(sdk, /crypto\.getRandomValues/);
assert.doesNotMatch(sdk, /crypto\.randomUUID/);
assert.match(protocol, /WORLD_MODULE_PROTOCOL_VERSION = 1/);
assert.match(trips, /Skyline 最近停车点/);
assert.doesNotMatch(moduleSource, /password|token|cookie/i);

console.log("Travel Journal World module contract passed");
