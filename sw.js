/* Сервис-воркер: офлайн-режим крестного хода.
   Стратегия:
   - статика (html/css/js/иконки/фото): cache-first после первого визита
   - навигация: network-first, при отсутствии сети — из кэша (fallback на главную)
   - gpx: cache-first

   v19: метаданные страниц — og-теги на языке локали, canonical и полноценный
   hreflang-кластер на каждой странице; добавлены /robots.txt и /sitemap.xml.

   v20: keywords на каждой странице развернуты в поисковые фразы («Вардавар 2027»,
   «крестный ход Ереван Севанаванк» и т.д.); из trek.gpx убрано прежнее имя
   «Вардавар 2027» — трек называется «Путь Святого Григория».
*/
const CACHE = "krestniy-hod-v20";
const PRECACHE = [
  "/",
  "/index.html",
  "/ru/",
  "/ru/index.html",
  "/ru/march/",
  "/ru/march/index.html",
  "/ru/pamyatka/",
  "/ru/pamyatka/index.html",
  "/ru/print/",
  "/ru/print/index.html",
  "/en/",
  "/en/index.html",
  "/en/march/",
  "/en/march/index.html",
  "/en/pamyatka/",
  "/en/pamyatka/index.html",
  "/en/print/",
  "/en/print/index.html",
  "/hy/",
  "/hy/index.html",
  "/hy/march/",
  "/hy/march/index.html",
  "/hy/pamyatka/",
  "/hy/pamyatka/index.html",
  "/hy/print/",
  "/hy/print/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/files/trek.gpx",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // только свои ресурсы

  // Навигация — сеть прежде всего, но с таймаутом: на «врущем» соединении
  // (lie-fi в горах) fetch может висеть 30–60 сек до браузерного таймаута.
  // Через 4.5 сек без ответа — отдаём кэш.
  if (request.mode === "navigate") {
    const network = fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
      return res;
    });
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("network timeout")), 4500)
    );
    event.respondWith(
      Promise.race([network, timeout]).catch(() =>
        caches
          .match(request)
          .then((r) => r || caches.match("/index.html"))
      )
    );
    return;
  }

  // Статика — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});