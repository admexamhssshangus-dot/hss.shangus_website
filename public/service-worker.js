/* eslint-disable no-restricted-globals */

// Service Worker for Govt. HSS Shangus PWA
// Provides basic caching for offline support and enables PWA installability

const CACHE_NAME = 'hss-shangus-v2';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico',
];

// Install: precache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

const NEVER_CACHE_PREFIXES = ['/api/', '/.netlify/functions/'];
const NEVER_CACHE_PATHS = new Set([
  '/privacy-removed.txt',
  '/slides/admins.json',
  '/slides/messages.json',
  '/slides/faculty_roster.csv',
  '/slides/faculty_roster_custom.csv',
]);

function isCacheableStaticAsset(pathname) {
  return pathname.startsWith('/static/') ||
    /\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?)$/i.test(pathname);
}

function mayStore(request, response) {
  if (!response || response.status !== 200) return false;
  const cacheControl = response.headers.get('Cache-Control') || '';
  return !/no-store|private/i.test(cacheControl) && request.credentials !== 'include';
}

// Fetch: network-first navigation shell and cache-first immutable assets.
// Data/API responses are deliberately never persisted in the service worker.
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (APIs, external resources)
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  if (NEVER_CACHE_PATHS.has(url.pathname) ||
      NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
      /\.(?:csv|json|txt)$/i.test(url.pathname)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (mayStore(event.request, response)) {
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', response.clone()));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (!isCacheableStaticAsset(url.pathname)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (mayStore(event.request, response)) {
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      }
      return response;
    }))
  );
});
