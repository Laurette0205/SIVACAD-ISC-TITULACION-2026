const CACHE_NAME = 'sivacad-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        console.warn('[SW] Could not cache some static assets');
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip non-HTTP(S) (WebSocket, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Skip cross-origin requests entirely
  if (url.origin !== location.origin) return;

  // API requests: network-first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ ok: false, message: 'Sin conexion', offline: true }),
              { headers: { 'Content-Type': 'application/json' }, status: 503 }
            );
          });
        })
    );
    return;
  }

  // Navigation requests: always try to serve index.html for SPA routing
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        // Return cached index.html immediately if available
        if (cached) {
          // Also update cache in background
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
          }).catch(() => {});
          return cached;
        }
        // Fallback to network if no cache
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => {
              c.put('/index.html', clone);
              c.put(request, clone);
            });
          }
          return response;
        }).catch(() => {
          // Last resort: inline HTML
          return new Response(
            '<!DOCTYPE html><html><head><title>Sin conexion</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center"><div><h1>Sin conexion a internet</h1><p>Verifica tu conexion y vuelve a intentar.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
          );
        });
      })
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts): cache-first, network fallback
  const isStaticAsset = /\.(js|css|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|map)(\?|$)/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return response;
      }).catch(() => {
        return new Response('', { status: 200 });
      });
      })
    );
    return;
  }

  // Other requests: network-first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // For any other failed request, return a minimal response
          return new Response('', { status: 200 });
        });
      })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sivacad-sync-pending') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_PENDING' });
        });
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
