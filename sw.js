const CACHE_NAME = "wade37417-retirement-dashboard-v3";
const APP_ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "script.js",
  "manifest.json",
  "icons/icon.svg",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const isSameOrigin = new URL(event.request.url).origin === self.location.origin;

  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (isSameOrigin) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
      }

      return networkResponse;
    }).catch(() =>
      caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match("index.html"))
    )
  );
});
