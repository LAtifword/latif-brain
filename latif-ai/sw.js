/* LATIF AI — service worker: cache-first app shell, network-passthrough
   for local APIs (Ollama / stats / whisper) — never cache model output. */
const CACHE = "latif-ai-shell-v2";
const SHELL = [
  "./", "./index.html", "./style.css", "./app.js", "./manifest.json", "./icon.svg",
  "./css/gx-design.css", "./css/gx-mods.css",
  "./js/mod-engine.js", "./js/gx-settings.js", "./js/audio-engine.js",
  "./js/fx-shader.js", "./js/stats-gauges.js", "./js/voice-backend.js", "./js/android16.js",
];

const LOCAL_API_PORTS = ["11434", "8000", "8001"]; // ollama, stats, whisper

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache local backend calls (Ollama/stats/whisper) — pass straight through.
  const isLocalHost = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (isLocalHost && LOCAL_API_PORTS.includes(url.port)) return;

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((res) => {
        if (res.ok && event.request.method === "GET") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      }).catch(() => cached)
    )
  );
});
