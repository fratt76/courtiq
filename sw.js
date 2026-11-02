/* BioKinetIQ service worker: l'app funziona anche offline. Il percorso resta /courtiq/. */
const CACHE = "biokinetiq-v15";
const ASSETS = ["./", "./index.html", "./style.css", "./app.js", "./data.js", "./video.js", "./prevenzione.js", "./prevenzione-data.js", "./figures.js", "./tecnica-data.js", "./kinetiq.js", "./mobile.js", "./i18n.js", "./auth.js", "./billing.js", "./coach.js", "./manifest.json",
  "./i18n/bg.json", "./i18n/cs.json", "./i18n/da.json", "./i18n/de.json", "./i18n/el.json", "./i18n/en.json", "./i18n/es.json", "./i18n/et.json", "./i18n/fi.json", "./i18n/fr.json", "./i18n/ga.json", "./i18n/hr.json", "./i18n/hu.json", "./i18n/it.json", "./i18n/lt.json", "./i18n/lv.json", "./i18n/mt.json", "./i18n/nl.json", "./i18n/pl.json", "./i18n/pt.json", "./i18n/ro.json", "./i18n/sk.json", "./i18n/sl.json", "./i18n/sv.json",
  "./vendor/leaflet/leaflet.css", "./vendor/leaflet/leaflet.js",
  "./vendor/leaflet/images/marker-icon.png", "./vendor/leaflet/images/marker-icon-2x.png", "./vendor/leaflet/images/marker-shadow.png",
  "./vendor/leaflet/images/layers.png", "./vendor/leaflet/images/layers-2x.png",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
  "./icons/kinetiq-logo.svg", "./icons/biokinetiq-simbolo-512.png", "./icons/biokinetiq-logo-600.png", "./icons/biokinetiq-logo-1200.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./icons/favicon-16.png", "./favicon.ico", "./icons/sport/sport-icons-sprite.svg"];
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
