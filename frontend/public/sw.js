const CACHE_NAME = 'duda-pwa-v3';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/icon.svg',
  '/icons/apple-touch-icon.png',
];

// Install: Cache essential shell assets with resilient allSettled
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.allSettled(
          PRECACHE_ASSETS.map(async (url) => {
            try {
              const res = await fetch(url, { cache: 'no-cache' });
              if (res.ok) {
                await cache.put(url, res);
              }
            } catch {
              // Silently ignore individual asset precache failures
            }
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Strategy based on request type
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and non-http schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 1. API Requests: Network First, never cache sensitive user data
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/coach/')
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline', message: 'You are currently offline.' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // Determine if this is an SPA navigation or HTML document request
  const isNavigate = request.mode === 'navigate' || request.destination === 'document';
  const isHtmlAccept = request.headers.get('accept')?.includes('text/html');
  const isSpaRoute = !url.pathname.includes('.') && !url.pathname.startsWith('/api/');

  // 2. SPA Navigation & HTML Requests (e.g. /todo, /workouts, /profile, /)
  if (isNavigate || isHtmlAccept || isSpaRoute) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
              cache.put('/index.html', networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Network failed (offline or connection refused): fallback to cached shell
          const cached =
            (await caches.match(request)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));

          if (cached) {
            return cached;
          }

          // Fallback offline HTML response so the FetchEvent promise NEVER rejects
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>duda.uz - Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#09090b;color:#f4f4f5;font-family:sans-serif;padding:32px;text-align:center;"><h2>duda.uz (Offline)</h2><p>Подключение к сети временно недоступно. Ваши данные сохранены локально в приложении.</p><button onclick="location.reload()" style="background:#10b981;color:#09090b;border:none;padding:12px 24px;border-radius:12px;font-weight:bold;cursor:pointer;margin-top:16px;">Повторить попытку</button></body></html>`,
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
    return;
  }

  // 3. Static Assets (JS chunks, CSS, Images, Fonts): Cache First, fallback to Network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // If an asset fails and it was a route, fallback to index.html
          if (isSpaRoute) {
            const fallbackIndex =
              (await caches.match('/index.html')) || (await caches.match('/'));
            if (fallbackIndex) return fallbackIndex;
          }
          // Return a clean 503 response instead of throwing an unhandled rejection
          return new Response('', {
            status: 503,
            statusText: 'Offline Asset Unavailable',
          });
        });
    })
  );
});

// Message event: Allow client to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
