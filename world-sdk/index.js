import { WORLD_MODULE_PROTOCOL_VERSION, WORLD_MODULE_REFERENCE_MIME } from "./protocol.js";

export * from "./protocol.js";

const REQUEST_TIMEOUT_MS = 10_000;
let port;
let connection;
let resolveConnection;
const connectionPromise = new Promise((resolve) => { resolveConnection = resolve; });
const pending = new Map();

function createRequestId() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function finishRequest(message) {
  const request = pending.get(message.requestId);
  if (!request) return;
  pending.delete(message.requestId);
  window.clearTimeout(request.timeout);
  if (message.ok) request.resolve(message);
  else request.reject(new Error(message.error || "World module request failed."));
}

window.addEventListener("message", (event) => {
  const message = event.data;
  const nextPort = event.ports[0];
  if (event.source !== window.parent || !message || message.type !== "world.module.connect" || message.protocolVersion !== WORLD_MODULE_PROTOCOL_VERSION || !nextPort || port) return;
  port = nextPort;
  connection = message;
  port.onmessage = (portEvent) => {
    const result = portEvent.data;
    if (!result || (result.type !== "world.module.resource.result" && result.type !== "world.module.reference.result") || typeof result.requestId !== "string") return;
    finishRequest(result);
  };
  port.start();
  port.postMessage({ type: "world.module.ready" });
  resolveConnection(connection);
});

function request(message) {
  if (!port) return Promise.reject(new Error("World module port is not connected."));
  const requestId = createRequestId();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(requestId);
      reject(new Error("World module request timed out."));
    }, REQUEST_TIMEOUT_MS);
    pending.set(requestId, { resolve, reject, timeout });
    port.postMessage({ ...message, requestId });
  });
}

function requireCapability(capability) {
  if (!connection?.capabilities?.includes(capability)) throw new Error(`World module capability is not granted: ${capability}`);
}

async function addReference(reference) {
  requireCapability("conversation.reference");
  await request({ type: "world.module.reference.add", reference });
}

async function prepareReference(reference) {
  requireCapability("conversation.reference");
  const result = await request({ type: "world.module.reference.prepare", reference });
  if (result.type !== "world.module.reference.result" || !result.ok || !result.token) throw new Error("World did not return a reference drag token.");
  return result.token;
}

export const world = {
  connect() {
    return connection ? Promise.resolve(connection) : connectionPromise;
  },

  reportStartupFailure(failure) {
    if (!port) return;
    port.postMessage({ type: "world.module.startup.failed", failure });
  },

  async readResource(slot) {
    requireCapability("resource.read");
    const result = await request({ type: "world.module.resource.read", slot });
    if (result.type !== "world.module.resource.result" || !result.ok) throw new Error("World returned an invalid resource response.");
    return result.resource;
  },

  addReference,

  async makeReferenceDraggable(element, reference, options = {}) {
    const token = await prepareReference(reference);
    element.setAttribute("draggable", "true");
    element.setAttribute("data-world-reference", reference.id);

    const onDragStart = (event) => {
      if (!event.dataTransfer) return;
      event.dataTransfer.setData(WORLD_MODULE_REFERENCE_MIME, token);
      event.dataTransfer.setData("text/plain", reference.title);
      event.dataTransfer.effectAllowed = "copy";
    };
    const onContextMenu = (event) => {
      if (options.contextMenu === false) return;
      event.preventDefault();
      void addReference(reference).then(options.onReferenced).catch((reason) => {
        options.onError?.(reason instanceof Error ? reason : new Error("Unable to add the reference."));
      });
    };
    element.addEventListener("dragstart", onDragStart);
    element.addEventListener("contextmenu", onContextMenu);
    return () => {
      element.removeEventListener("dragstart", onDragStart);
      element.removeEventListener("contextmenu", onContextMenu);
      element.removeAttribute("draggable");
      element.removeAttribute("data-world-reference");
    };
  },
};
