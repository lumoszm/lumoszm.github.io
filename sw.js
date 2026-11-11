/* ATLAS 离线缓存
   - 网页本身和数据清单（cities/photos/目录）：先联网取最新的，没网时用缓存
   - 地球贴图、程序库、图标：先用缓存，同时在后台更新
   - 其他网站的请求（数据库、Unsplash 照片、地图瓦片）不经过这里 */
var V = "atlas-dbaf6d4990";
var CORE = ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "tex/day4k.jpg", "tex/night4k.jpg", "tex/water4k.png", "tex/height4k.jpg", "tex/land2k.png", "cities.json", "photos.json"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(CORE); }).catch(function () {}).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("atlas-") === 0 && k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function fresh(req) {
  return fetch(req).then(function (r) {
    if (r && r.ok) { var cp = r.clone(); caches.open(V).then(function (c) { c.put(req, cp); }); }
    return r;
  });
}
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  var p = u.pathname;
  var isPage = req.mode === "navigate" || /\/(index\.html)?$/.test(p);
  var isData = /\.(json|webmanifest)$/.test(p);
  if (isPage || isData) {
    e.respondWith(fresh(req).catch(function () {
      return caches.match(req, { ignoreSearch: isData }).then(function (r) { return r || (isPage ? caches.match("./") : Response.error()); });
    }));
    return;
  }
  if (/\/(tex|lib|icons)\//.test(p)) {
    e.respondWith(caches.match(req).then(function (hit) {
      var net = fresh(req).catch(function () { return hit; });
      return hit || net;
    }));
  }
});
