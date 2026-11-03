importScripts("precache-list.js");
// v3: pdf.js reader + Community uploads. v2: illustrated covers. FILES cache name kept at v1 on purpose so users keep their downloaded PDFs.
var SHELL = "wp-shell-v3", FILES = "wp-files-v1", COVERS = "wp-covers-v2";
var SHELL_FILES = ["./", "index.html", "styles.css", "app.js", "config.js", "data.js", "manifest.json", "precache-list.js",
  "pdfjs/pdf.min.mjs", "pdfjs/pdf.worker.min.mjs",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-64.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(SHELL_FILES); })
    .then(function () {
      // precache all cover images; a single failure must not break install (CSS cover is the fallback)
      return caches.open(COVERS).then(function (c) {
        return Promise.all((self.COVER_FILES || []).map(function (u) { return c.add(u).catch(function () {}); }));
      });
    })
    .then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== SHELL && k !== FILES && k !== COVERS; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  var isFile = req.url.indexOf("/library/") >= 0, isCover = req.url.indexOf("/covers/") >= 0;
  e.respondWith(caches.match(req.url, { ignoreSearch: true }).then(function (hit) {
    var net = fetch(req.url).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(isFile ? FILES : (isCover ? COVERS : SHELL)).then(function (c) { c.put(req.url, copy); }); }
      return res;
    });
    if (hit) { net.catch(function () {}); return hit; }
    return net.catch(function () { return caches.match("index.html"); });
  }));
});
self.addEventListener("message", function (e) {
  if (!e.data || e.data.type !== "cache-all") return;
  var list = self.LIBRARY_FILES || [], done = 0, src = e.source;
  caches.open(FILES).then(function (c) {
    var i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve();
      var u = new URL(encodeURI(list[i++]), self.registration.scope).href;
      return c.match(u).then(function (hit) { return hit || fetch(u).then(function (r) { if (r.ok) return c.put(u, r); }); })
        .catch(function () {}).then(function () { done++; if (src) src.postMessage({ type: "progress", done: done, total: list.length }); return next(); });
    }
    return Promise.all([next(), next(), next()]);
  });
});
