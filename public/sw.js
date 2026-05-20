const CACHE_NAME = 'tetris-v3';
const urlsToCache = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Stratégie optimisée: network-first pour HTML, cache-first pour assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // HTML/Navigation: network-first pour updates rapides
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Mettre en cache la réponse pour offline
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback vers cache si offline
          return caches.match(event.request);
        })
    );
    return;
  }

  // Assets (JS, CSS, images): cache-first avec update background
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Retourner cache immédiatement, mais update en background
          fetch(event.request).then((response) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }).catch(() => {
            // Ignorer erreurs réseau en background update
          });
          return cachedResponse;
        }

        // Pas en cache: fetch et mettre en cache
        return fetch(event.request).then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Prendre le contrôle de tous les clients
      return self.clients.claim();
    }).then(() => {
      // Notifier tous les clients qu'une mise à jour est disponible
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: CACHE_NAME
          });
        });
      });
    })
  );
});

// Écouter les messages des clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
