// Offline support. 99f40dfda0 is filled in by build_site.py, so each build refreshes the cached files.
const BUILD = "99f40dfda0";
const APP_CACHE = "wcards-app-" + BUILD;
const APP_FILES = ["./", "index.html", "app.css", "app.js", "search.js", "data.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys()
    .then((names) => Promise.all(names.filter((n) => n.startsWith("wcards-app-") && n !== APP_CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET" || url.origin !== location.origin) return;
  ev.respondWith(caches.match(ev.request, { ignoreSearch: true }).then((hit) => hit || fetch(ev.request)));
});
