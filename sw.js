/* KinetIQ service worker: l'app funziona anche offline. Il percorso resta /courtiq/. */
const CACHE = "courtiq-v7";
const ASSETS = ["./", "./index.html", "./style.css", "./app.js", "./data.js", "./video.js", "./prevenzione.js", "./prevenzione-data.js", "./kinetiq.js", "./manifest.json",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
/* modello di analisi (vendor/): scaricato solo alla prima analisi, poi servito dalla cache senza riscaricarlo */
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  if (new URL(e.request.url).pathname.includes("/vendor/")) {
    e.respondWith(caches.open(CACHE).then(cache => cache.match(e.request, { ignoreSearch: true }).then(hit => hit ||
      fetch(e.request).then(res => { if (res.ok && res.status === 200) cache.put(e.request, res.clone()); return res; }))));
    return;
  }
  /* resto dell'app: risponde subito dalla cache e aggiorna in background (stale-while-revalidate) */
  e.respondWith(caches.open(CACHE).then(cache => cache.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
      .catch(() => hit || cache.match("./index.html"));
    return hit || net;
  })));
});
