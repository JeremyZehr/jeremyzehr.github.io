self.importScripts('gfreq_refs.json.js');
self.importScripts('gfreq_dic_3.json.js');
self.importScripts('gfreq_dic_4.json.js');
self.importScripts('gfreq_dic_5.json.js');
self.importScripts('gfreq_dic_6.json.js');
self.importScripts('gfreq_dic_7.json.js');

console.log("Hello from sw.js");

// Files to cache
const cacheName = 'allwords-v1';
const appShellFiles = [
  '/index.html',
  '/app.js',
  '/style.css',
  '/gfreq_refs.json.js',
  '/gfreq_dic_3.json.js',
  '/gfreq_dic_4.json.js',
  '/gfreq_dic_5.json.js',
  '/gfreq_dic_6.json.js',
  '/gfreq_dic_7.json.js'
];

// Installing Service Worker
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  e.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    console.log('[Service Worker] Caching all: app shell and content');
    await cache.addAll(contentToCache);
  })());
});


// Fetching content using Service Worker
self.addEventListener('fetch', (e) => {
  // Cache http and https only, skip unsupported chrome-extension:// and file://...
  if (!(
     e.request.url.startsWith('http:') || e.request.url.startsWith('https:')
  )) {
      return; 
  }

e.respondWith((async () => {
  const r = await caches.match(e.request);
  console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
  if (r) return r;
  const response = await fetch(e.request);
  const cache = await caches.open(cacheName);
  console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
  cache.put(e.request, response.clone());
  return response;
})());
});
