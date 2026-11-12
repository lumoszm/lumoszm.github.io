/* ATLAS 离线缓存（版本 336b89f505）
   原则：网络不稳时（比如国内直连 GitHub），凡是以前成功取到过的东西都还能用。
   - 缓存只有一个，名字固定；发布新版本不清空旧内容，只在后台逐个更新
   - 网页和数据清单：先联网，几秒内没回来就先用上一次的
   - 地球贴图、程序库、图标、带版本号的数据：先用缓存，后台更新
   - 其他网站的请求（数据库、Unsplash 照片、地图瓦片）不经过这里 */
var V = "atlas-static-1";
var CORE = ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "tex/day4k.jpg", "tex/night4k.jpg", "tex/water4k.png", "tex/height4k.jpg", "tex/sky4k.jpg", "tex/land2k.png", "cities.json", "photos.json", "lib/catalog.json"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(V).then(function (c) {
    /* 逐个取，哪个失败都不影响其他的 */
    return Promise.all(CORE.map(function (u) {
      return fetch(u, { cache: "no-cache" }).then(function (r) { if (r && r.ok) return c.put(u, r).then(function () { return 1; }); return 0; }).catch(function () { return 0; });
    }));
  }).then(function (ok) {
    self.__allOk = ok.every(function (x) { return x; });
  }).catch(function () {}).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  /* 旧版本留下的缓存：只有新缓存已经完整备好时才清掉，否则留着兜底 */
  e.waitUntil(caches.keys().then(function (ks) {
    if (!self.__allOk) return;
    return Promise.all(ks.filter(function (k) { return k.indexOf("atlas-") === 0 && k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function fresh(req, nc) {
  return fetch(nc ? new Request(req, { cache: "no-cache" }) : req).then(function (r) {
    if (r && r.ok) { var cp = r.clone(); caches.open(V).then(function (c) { c.put(req, cp); }).catch(function () {}); }
    return r;
  });
}
/* 先联网；ms 毫秒内没结果、或者联网失败，就用缓存里上一次的 */
function netFirst(req, nc, ms, opt, fallback) {
  var cached = caches.match(req, opt).then(function (r) { return r || (fallback ? caches.match(fallback) : undefined); });
  var net = fresh(req, nc).then(function (r) { if (r && (r.ok || r.type === "opaqueredirect")) return r; return cached.then(function (c) { return c || r; }); });
  var slow = new Promise(function (res) { setTimeout(res, ms); }).then(function () { return cached; }).then(function (c) { return c || net; });
  return Promise.race([net, slow]).catch(function () {
    return cached.then(function (c) { if (c) return c; throw new Error("offline"); });
  });
}
function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    if (hit) { fresh(req).catch(function () {}); return hit; }
    return fresh(req);
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
  if (isPage) { e.respondWith(netFirst(req, true, 4000, { ignoreSearch: true }, "./")); return; }
  if (isData) {
    /* 带 ?v= 的地址内容不会变：有缓存就直接用 */
    if (/[?&]v=/.test(u.search)) e.respondWith(caches.match(req).then(function (hit) { return hit || netFirst(req, false, 8000, { ignoreSearch: true }); }));
    else e.respondWith(netFirst(req, false, 4000, { ignoreSearch: true }));
    return;
  }
  if (/\/(tex|lib|icons)\//.test(p)) e.respondWith(cacheFirst(req));
});
