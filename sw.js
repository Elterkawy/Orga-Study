const CACHE_NAME = 'orga-study-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './OrgaStudy.css',
  './OrgaStudy.js',
  './daily-scheduler.css',
  './manifest.json'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(err => console.warn('Cache addAll failed:', err))
  );
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie de cache : Réseau d'abord, sinon Cache
self.addEventListener('fetch', (event) => {
  // Ne pas mettre en cache les requêtes API
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => new Response('Offline - API not available', { status: 503 }))
    );
    return;
  }

  // Pour les autres ressources : réseau d'abord, fallback cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre en cache les réponses réussies
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // Si pas de réseau, utiliser le cache
        return caches.match(event.request)
          .then((response) => {
            return response || new Response('Offline - resource not cached', { status: 503 });
          });
      })
  );
});