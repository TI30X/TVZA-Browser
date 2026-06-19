/* TVZA Service Worker v26 - offline-first */

const CACHE = 'tvza-v26';
const FIREBASE_SDK = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js',
];
const SHELL = [
  './browser.html',
  './browser-settings.html',
  './browser.css',
  './browser.js',
  './browser-settings.js',
  './style.css',
  './theme.js',
  './manifest.json',
  './firebase-config.js',
  './icons/TvZ_Logo.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  ...FIREBASE_SDK,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(url => c.add(url))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Cache the Firebase SDK from gstatic too (needed offline)
  const isGstatic = url.hostname === 'www.gstatic.com';
  if (url.origin !== self.location.origin && !isGstatic) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => null);
      return cached || network;
    })
  );
});
