// ஜோதிஷம் Service Worker v1.0
const CACHE_NAME = 'jyothisham-v1';
const CACHE_URLS = [
  './jyothisham_v3.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700&family=Cinzel+Decorative:wght@700&display=swap'
];

// ── INSTALL: cache core files ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('SW: caching app shell');
      // Cache local files reliably; external fonts best-effort
      return cache.addAll([
        './jyothisham_v3.html',
        './manifest.json'
      ]).then(() => {
        // Try to cache Google Fonts (non-critical)
        return cache.add(
          'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700&family=Cinzel+Decorative:wght@700&display=swap'
        ).catch(() => {});
      });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('SW: deleting old cache', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first for app, network-first for fonts ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // For Google Fonts — network first, fall back to cache
  if (url.hostname.includes('fonts.g')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For everything else — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: return main HTML for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./jyothisham_v3.html');
        }
      });
    })
  );
});

// ── BACKGROUND SYNC: refresh planetary data when back online ──
self.addEventListener('sync', event => {
  if (event.tag === 'refresh-planets') {
    console.log('SW: background sync triggered');
    // Notify all open clients to refresh
    event.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(client => client.postMessage({ type: 'REFRESH_NOW' }))
      )
    );
  }
});

// ── PUSH NOTIFICATIONS (ready for future use) ──
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ஜோதிஷம்';
  const options = {
    body: data.body || 'கிரக நிலை மாற்றம் உள்ளது',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './jyothisham_v3.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
