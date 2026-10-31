importScripts("precache-list.js");
var SHELL = "wp-shell-v1", FILES = "wp-files-v1";
var SHELL_FILES = ["./", "index.html", "styles.css", "app.js", "data.js", "manifest.json", "precache-list.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-64.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(SHELL_FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== SHELL && k !== FILES; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  var isFile = req.url.indexOf("/library/") >= 0;
  e.respondWith(caches.match(req.url, { ignoreSearch: true }).then(function (hit) {
    var net = fetch(req.url).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(isFile ? FILES : SHELL).then(function (c) { c.put(req.url, copy); }); }
      return res;
    });
    if (hit) { if (!isFile) net.catch(function () {}); return hit; }
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
