importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const WISP_URL = (self.location.protocol === "https:" ? "wss" : "ws") + "://" + self.location.host + "/wisp/";

const DEFAULT_CONFIG = {
  prefix: "/scramjet/",
  codec: "plain",
  wasm: "/scram/scramjet.wasm.wasm",
  all: "/scram/scramjet.all.js",
  sync: "/scram/scramjet.sync.js",
  wisp: WISP_URL,
};

let configLoaded = false;

async function ensureConfig() {
  if (configLoaded) return;
  try {
    await scramjet.loadConfig();
  } catch (e) {}
  if (!scramjet.config) {
    scramjet.config = DEFAULT_CONFIG;
  } else {
    scramjet.config.wisp = WISP_URL;
    scramjet.config.wasm = scramjet.config.wasm || DEFAULT_CONFIG.wasm;
    scramjet.config.all = scramjet.config.all || DEFAULT_CONFIG.all;
    scramjet.config.sync = scramjet.config.sync || DEFAULT_CONFIG.sync;
    scramjet.config.prefix = scramjet.config.prefix || DEFAULT_CONFIG.prefix;
  }
  configLoaded = true;
}

self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    await ensureConfig();
    if (scramjet.route(event)) {
      return scramjet.fetch(event);
    }
    return fetch(event.request);
  })());
});
