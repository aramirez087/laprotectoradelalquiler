// Cache only this self-contained public screen. Account pages, search results,
// API responses, RSC payloads and submitted reviews always use the network.
// Bump the version whenever offline.html changes.
const CACHE_PREFIX = 'protectora-offline-'
const CACHE_NAME = `${CACHE_PREFIX}v1`
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch(OFFLINE_URL, { cache: 'reload', credentials: 'omit' })
    if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('Offline screen unavailable')
    }
    const cache = await caches.open(CACHE_NAME)
    await cache.put(OFFLINE_URL, response)
    // Let updates wait until existing tabs close; never reload an unsaved form.
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin) return
  // These endpoints must retain their own response semantics even on a direct visit.
  if (/^\/(?:api|auth)(?:\/|$)/.test(url.pathname)) return

  event.respondWith((async () => {
    try {
      return await fetch(request)
    } catch {
      try {
        const cache = await caches.open(CACHE_NAME)
        const offline = await cache.match(OFFLINE_URL)
        if (offline) return offline
      } catch {
        // Storage access can be revoked after the worker has been installed.
      }
      // Storage may also have been evicted since installation.
      return new Response('Sin conexión. Vuelva a intentarlo cuando tenga internet.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
  })())
})
