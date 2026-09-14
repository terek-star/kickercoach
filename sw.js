const CACHE_NAME = 'kickercoach-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/squad.js',
  './js/schedule.js',
  './js/lineup.js',
  './js/soccerdrills-catalog.js',
  './js/ai-service.js',
  './js/pitch-renderer.js',
  './js/training.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install Event: Offline-Cache aufbauen
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Speichere App-Dateien im Cache...');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Alte Caches aufräumen
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Entferne veralteten Cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Netzwerk-First mit Cache-Fallback für lokale Ressourcen, Bypass für APIs
self.addEventListener('fetch', (e) => {
  // Nur Standard http/https Anfragen verarbeiten
  if (!e.request.url.startsWith('http')) return;

  // Externe APIs (wie Google Gemini API) direkt über Netzwerk abwickeln
  if (e.request.url.includes('googleapis.com')) {
    return;
  }

  e.respondWith(
    fetch(e.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseClone);
        });
      }
      return networkResponse;
    }).catch(() => {
      // Offline-Fallback aus dem Cache
      return caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
