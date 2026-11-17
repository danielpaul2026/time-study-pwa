import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { defineConfig } from 'vite'

const basePath = '/time-study-pwa/'

function offlineServiceWorker() {
  return {
    name: 'offline-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = [ ...new Set([
        ...Object.keys(bundle),
        'index.html',
        'manifest.webmanifest',
        'app-icon.svg',
        'favicon.svg',
      ]) ].sort()
      const cacheHash = createHash('sha256')
      files.forEach(file => {
        const output = bundle[file]
        cacheHash.update(file)
        if (output) {
          cacheHash.update(output.type === 'chunk' ? output.code : output.source)
        }
      })
      const cacheVersion = `${cacheHash.digest('hex').slice(0, 12)}-${Date.now().toString(36)}`
      const precacheUrls = JSON.stringify(files.map(file => `${basePath}${file}`))
      const serviceWorker = `
const CACHE_NAME = 'time-study-pwa-${cacheVersion}';
const PRECACHE_URLS = ${precacheUrls};
const APP_SHELL_URL = new URL('index.html', self.registration.scope).href;
const SCOPE_PATH = new URL(self.registration.scope).pathname;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith('time-study-pwa-') && cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin ||
      !requestUrl.pathname.startsWith(SCOPE_PATH)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      if (request.mode === 'navigate') {
        try {
          const response = await fetch(request);
          if (response.ok) return response;
        } catch {
          const appShell = await cache.match(APP_SHELL_URL);
          if (appShell) return appShell;
          throw new Error('The app shell is not available offline.');
        }

        const appShell = await cache.match(APP_SHELL_URL);
        if (appShell) return appShell;
        return fetch(request);
      }

      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
  );
});
`

      this.emitFile({
        type: 'asset',
        fileName: 'service-worker.js',
        source: serviceWorker,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [react(), offlineServiceWorker()],
})
