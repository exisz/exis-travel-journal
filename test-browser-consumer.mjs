import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL(".", import.meta.url));
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
      const filePath = normalize(join(root, relativePath));
      if (!filePath.startsWith(root)) throw new Error("Invalid path");
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) throw new Error("Not a file");
      response.writeHead(200, {
        "access-control-allow-origin": "*",
        "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
      });
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

const localServer = process.env.SITE_URL ? undefined : await startStaticServer();
const siteUrl = new URL(process.env.SITE_URL || localServer.url).href;
const allowedOrigin = new URL(siteUrl).origin;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.route("**/*", (route) => {
  const requestUrl = new URL(route.request().url());
  if (["about:", "data:"].includes(requestUrl.protocol) || requestUrl.origin === allowedOrigin) return route.continue();
  return route.abort();
});

try {
  await page.setContent(`<!doctype html>
    <html><body><script>
      window.worldHarness = { readyCount: 0, requests: [], ports: [] };
      const frame = document.createElement("iframe");
      frame.id = "travel-journal";
      frame.setAttribute("sandbox", "allow-scripts");
      frame.addEventListener("load", () => {
        const channel = new MessageChannel();
        window.worldHarness.ports.push(channel.port1);
        channel.port1.onmessage = (event) => {
          const message = event.data;
          if (!message) return;
          if (message.type === "world.module.ready") {
            window.worldHarness.readyCount += 1;
            return;
          }
          if (message.type === "world.module.reference.prepare" || message.type === "world.module.reference.add") {
            window.worldHarness.requests.push(message);
            channel.port1.postMessage({
              type: "world.module.reference.result",
              requestId: message.requestId,
              ok: true,
              ...(message.type === "world.module.reference.prepare" ? { token: "reference-token-" + message.requestId } : {}),
            });
          }
        };
        channel.port1.start();
        frame.contentWindow.postMessage({
          type: "world.module.connect",
          protocolVersion: 1,
          instanceId: "travel-journal-browser-test",
          capabilities: ["conversation.reference"],
        }, "*", [channel.port2]);
      });
      frame.src = ${JSON.stringify(siteUrl)};
      document.body.append(frame);
    <\/script></body></html>`);

  assert.equal(await page.locator("#travel-journal").getAttribute("sandbox"), "allow-scripts");
  await page.waitForFunction(() => window.worldHarness.readyCount === 1);

  const frame = page.frameLocator("#travel-journal");
  const firstReference = frame.locator('[data-world-kind="trip"]').first();
  await firstReference.locator(".world-reference-button").waitFor();
  if (process.env.DEBUG_BROWSER) {
    await page.waitForTimeout(1_000);
    console.log({ pageErrors, harness: await page.evaluate(() => window.worldHarness) });
  }
  await firstReference.evaluate((element) => new Promise((resolve, reject) => {
    if (element.getAttribute("draggable") === "true") return resolve();
    const observer = new MutationObserver(() => {
      if (element.getAttribute("draggable") !== "true") return;
      observer.disconnect();
      resolve();
    });
    observer.observe(element, { attributes: true, attributeFilter: ["draggable"] });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error("Reference did not become draggable"));
    }, 10_000);
  }));
  assert.equal(await firstReference.getAttribute("draggable"), "true");
  assert.equal(await firstReference.getAttribute("data-world-reference"), "new-zealand-2026");

  await firstReference.locator(".world-reference-button").click();
  await page.waitForFunction(() => window.worldHarness.requests.some((message) => message.type === "world.module.reference.add"));
  const firstAddedReference = await page.evaluate(() => window.worldHarness.requests.find((message) => message.type === "world.module.reference.add").reference);
  assert.equal(firstAddedReference.type, "travel.trip");
  assert.equal(firstAddedReference.id, "new-zealand-2026");

  const firstAddCount = await page.evaluate(() => window.worldHarness.requests.filter((message) => message.type === "world.module.reference.add").length);
  await page.evaluate((nextUrl) => {
    document.querySelector("#travel-journal").src = nextUrl;
  }, new URL(`?browser-test-reload=${Date.now()}`, siteUrl).href);
  await page.waitForFunction(() => window.worldHarness.readyCount === 2);

  const reloadedReference = page.frameLocator("#travel-journal").locator('[data-world-kind="trip"]').first();
  await reloadedReference.locator(".world-reference-button").waitFor();
  await reloadedReference.locator(".world-reference-button").click();
  await page.waitForFunction((previousCount) => window.worldHarness.requests.filter((message) => message.type === "world.module.reference.add").length > previousCount, firstAddCount);

  assert.deepEqual(pageErrors, []);
  console.log(`Travel Journal sandboxed World consumer passed (first load + reload): ${siteUrl}`);
} finally {
  await browser.close();
  await localServer?.close();
}
