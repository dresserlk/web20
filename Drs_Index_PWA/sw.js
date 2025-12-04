// Modern Service Worker for StoreA PWA
// Version: 5.0.0 - Enhanced caching and offline experience
const CACHE_VERSION = "storea-v5.0";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;
// Core files that need to be cached immediately
const CORE_ASSETS = [
  "./",
  "index.html",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
];
// Maximum cache sizes
const MAX_DYNAMIC_CACHE_SIZE = 50;
const MAX_IMAGE_CACHE_SIZE = 100;
// Helper: Limit cache size
const limitCacheSize = async (cacheName, maxSize) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    await cache.delete(keys[0]);
    await limitCacheSize(cacheName, maxSize);
  }
};
// Install Event - Cache core assets
self.addEventListener("install", event => {
  console.log("[SW] Installing service worker...");
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log("[SW] Caching core assets");
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error("[SW] Installation failed:", err))
  );
});
// Activate Event - Clean up old caches
self.addEventListener("activate", event => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== IMAGE_CACHE)
            .map(key => {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});
// Fetch Event - Network first with cache fallback
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  // Skip non-GET requests
  if (request.method !== "GET") return;
  // Skip external API calls from caching (always fetch fresh)
  if (url.origin.includes("dresser-manager.workers.dev")) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache API response for offline fallback
          const cloneResponse = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, cloneResponse);
          });
          return response;
        })
        .catch(() => {
          // Return cached API data if offline
          return caches.match(request)
            .then(cached => cached || new Response(
              JSON.stringify({ error: "Offline - No cached data available" }),
              { headers: { "Content-Type": "application/json" } }
            ));
        })
    );
    return;
  }
  // Handle images separately with image cache
  if (request.destination === "image") {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response && response.status === 200) {
              const cloneResponse = response.clone();
              caches.open(IMAGE_CACHE).then(cache => {
                cache.put(request, cloneResponse);
                limitCacheSize(IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE);
              });
            }
            return response;
          });
        })
        .catch(() => {
          // Return placeholder for failed image loads
          return new Response(
            '<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="300" height="300" fill="#f3f4f6"/><text x="50%" y="50%" text-anchor="middle" fill="#9ca3af" font-size="16">Image unavailable</text></svg>',
            { headers: { "Content-Type": "image/svg+xml" } }
          );
        })
    );
    return;
  }
  // Cache first strategy for static assets (CSS, JS, fonts)
  if (url.origin === location.origin || url.origin.includes("googleapis") || url.origin.includes("gstatic")) {
    event.respondWith(
      caches.match(request)
        .then(cached => cached || fetch(request)
          .then(response => {
            if (response && response.status === 200) {
              const cloneResponse = response.clone();
              caches.open(STATIC_CACHE).then(cache => {
                cache.put(request, cloneResponse);
              });
            }
            return response;
          })
        )
        .catch(() => caches.match("./"))
    );
    return;
  }
  // Network first for everything else
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const cloneResponse = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, cloneResponse);
            limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
          });
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match("./")))
  );
});
// Background Sync (for future offline order queue)
self.addEventListener("sync", event => {
  if (event.tag === "sync-orders") {
    console.log("[SW] Background sync triggered");
    event.waitUntil(
      // Future: Sync offline orders when connection restored
      Promise.resolve()
    );
  }
});
// Push Notifications (for future order updates)
self.addEventListener("push", event => {
  const options = {
    body: event.data ? event.data.text() : "New update from StoreA!",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  event.waitUntil(
    self.registration.showNotification("StoreA", options)
  );
});
// Message handler for cache updates
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then(keys => {
        return Promise.all(keys.map(key => caches.delete(key)));
      })
    );
  }
});
console.log("[SW] Service Worker loaded successfully ✅");
