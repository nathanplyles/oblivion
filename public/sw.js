importScripts("/scram/scramjet.all.js?v=20260311b");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
let scramjetConfigPromise = null;
const SCRAMJET_CACHE_MARKERS = ["scramjet", "$scramjet", "oblivion-sj"];

function isScramjetCacheKey(key) {
  const lower = String(key || "").toLowerCase();
  return SCRAMJET_CACHE_MARKERS.some((marker) => lower.includes(marker));
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => isScramjetCacheKey(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function safeFetch(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response("offline", {
      status: 503,
      statusText: "offline",
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function handleRequest(event) {
  const url = event.request.url;
  const origin = self.location.origin;

  // Keep app/runtime internals out of proxy handling.
  if (
    url === `${origin}/sw.js` ||
    url === `${origin}/scramjet/sw.js` ||
    url === `${origin}/register-sw.js` ||
    url.startsWith(`${origin}/api/`) ||
    url.startsWith(`${origin}/scram/`) ||
    url.startsWith(`${origin}/baremux/`) ||
    url.startsWith(`${origin}/libcurl/`)
  ) {
    return safeFetch(event.request);
  }

  if (
    url.includes("youtube.com/iframe_api") ||
    url.includes("ytimg.com") ||
    url.includes("youtube.com/embed") ||
    url.includes("cdn.jsdelivr.net") ||
    url.includes("googlevideo.com") ||
    url.includes("googleusercontent.com")
  ) {
    return safeFetch(event.request);
  }

  try {
    if (!scramjetConfigPromise) {
      scramjetConfigPromise = scramjet.loadConfig();
    }
    await scramjetConfigPromise;
  } catch {
    scramjetConfigPromise = null;
    return safeFetch(event.request);
  }

  if (scramjet.route(event)) return scramjet.fetch(event);
  return safeFetch(event.request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event).catch(() => safeFetch(event.request)));
});
