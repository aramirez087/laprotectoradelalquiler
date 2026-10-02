import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const origin = 'https://example.test'
const workerCode = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const offlineHtml = '<!doctype html><html lang="es"><title>Sin conexión</title></html>'

function worker({ fetch: network = async () => new Response(offlineHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }) } = {}) {
  const events = new Map()
  const stores = new Map()
  const calls = { fetch: [], writes: [], deletes: [], claim: 0, skipWaiting: 0, navigate: 0 }
  const caches = {
    async keys() { return [...stores.keys()] },
    async delete(name) { calls.deletes.push(name); return stores.delete(name) },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map())
      const entries = stores.get(name)
      return {
        async put(url, response) {
          calls.writes.push({ name, url })
          entries.set(url, response.clone())
        },
        async match(url) { return entries.get(url)?.clone() },
      }
    },
  }
  vm.runInNewContext(workerCode, {
    self: {
      location: { origin },
      addEventListener: (name, callback) => events.set(name, callback),
      skipWaiting: async () => { calls.skipWaiting++ },
      clients: {
        claim: async () => { calls.claim++ },
        matchAll: async () => [{ navigate: async () => { calls.navigate++ } }],
      },
    },
    caches, URL, Response,
    fetch: async (...args) => { calls.fetch.push(args); return network(...args) },
  }, { filename: 'public/sw.js' })

  return {
    stores, calls, caches,
    async lifecycle(name) {
      const pending = []
      events.get(name)?.({ waitUntil: task => pending.push(task) })
      await Promise.all(pending)
    },
    async request(request) {
      let intercepted = false
      let response
      events.get('fetch')?.({
        request,
        respondWith: task => { intercepted = true; response = task },
      })
      return { intercepted, response: await response }
    },
  }
}

function navigation(path = '/', overrides = {}) {
  return { url: new URL(path, origin).href, method: 'GET', mode: 'navigate', ...overrides }
}

test('installation caches only the public offline screen without session credentials', async () => {
  const h = worker()
  await h.lifecycle('install')
  assert.equal(h.calls.fetch.length, 1)
  const [url, options] = h.calls.fetch[0]
  assert.equal(url, '/offline.html')
  assert.equal(options.credentials, 'omit')
  assert.equal(options.cache, 'reload')
  assert.equal(h.stores.size, 1)
  const [[, entries]] = h.stores
  assert.deepEqual([...entries.keys()], ['/offline.html'])
  assert.equal(await entries.get('/offline.html').text(), offlineHtml)
  assert.equal(h.calls.skipWaiting, 0)
  assert.equal(h.calls.navigate, 0)
})

test('an unavailable, redirected, or non-HTML offline screen fails installation without caching it', async t => {
  const redirected = new Response(offlineHtml, { headers: { 'Content-Type': 'text/html' } })
  Object.defineProperty(redirected, 'redirected', { value: true })
  for (const [name, network] of [
    ['HTTP failure', async () => new Response('Unavailable', { status: 503, headers: { 'Content-Type': 'text/html' } })],
    ['login redirect', async () => redirected],
    ['wrong media type', async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } })],
    ['missing media type', async () => new Response(null)],
    ['network failure', async () => { throw new TypeError('Offline') }],
  ]) {
    await t.test(name, async () => {
      const h = worker({ fetch: network })
      await assert.rejects(h.lifecycle('install'))
      assert.equal(h.calls.writes.length, 0)
      assert.equal(h.calls.skipWaiting, 0)
    })
  }
})

test('successful, redirected and failed HTTP navigations retain their network response without caching', async t => {
  for (const status of [200, 302, 401, 404, 500]) {
    await t.test(String(status), async () => {
      const expected = new Response('Private account response', {
        status,
        headers: { 'Cache-Control': 'private, no-store', ...(status === 302 ? { Location: '/login' } : {}) },
      })
      const h = worker({ fetch: async () => expected })
      const request = navigation('/fichas/123?consulta=persona')
      const actual = await h.request(request)
      assert.equal(actual.intercepted, true)
      assert.equal(actual.response, expected)
      assert.equal(h.calls.fetch[0][0], request)
      assert.equal(h.calls.writes.length, 0)
      assert.equal(h.stores.size, 0)
    })
  }
})

test('offline document navigation uses only the cached public screen, including private routes', async () => {
  let online = true
  const h = worker({ fetch: async () => {
    if (!online) throw new TypeError('Network unavailable')
    return new Response(offlineHtml, { headers: { 'Content-Type': 'text/html' } })
  } })
  await h.lifecycle('install')
  online = false
  for (const path of ['/', '/fichas/123?consulta=privada', '/perfil', '/admin', '/resenas/nueva']) {
    const result = await h.request(navigation(path))
    assert.equal(result.intercepted, true)
    assert.equal(await result.response.text(), offlineHtml)
  }
  assert.equal(h.calls.writes.length, 1)
  assert.equal(h.calls.writes[0].url, '/offline.html')
  assert.deepEqual([...h.stores.values()][0].size, 1)
})

test('evicted offline storage yields an uncached service-unavailable response', async () => {
  const h = worker({ fetch: async () => { throw new TypeError('Offline') } })
  const { response } = await h.request(navigation('/perfil'))
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match(response.headers.get('content-type'), /^text\/plain/)
  assert.match(await response.text(), /Sin conexión/)
  assert.equal(h.calls.writes.length, 0)
})

test('revoked cache access after activation still returns an uncached offline response', async t => {
  for (const operation of ['open', 'match']) {
    await t.test(`cache ${operation} rejects`, async () => {
      const h = worker({ fetch: async request => {
        if (request === '/offline.html') return new Response(offlineHtml, { headers: { 'Content-Type': 'text/html' } })
        throw new TypeError('Offline')
      } })
      await h.lifecycle('install')
      await h.lifecycle('activate')
      const open = h.caches.open
      h.caches.open = async name => {
        if (operation === 'open') throw new Error('Storage access revoked')
        const cache = await open(name)
        cache.match = async () => { throw new Error('Cache read denied') }
        return cache
      }
      const { intercepted, response } = await h.request(navigation('/perfil'))
      assert.equal(intercepted, true)
      assert.equal(response.status, 503)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.match(response.headers.get('content-type'), /^text\/plain/)
      assert.match(await response.text(), /Sin conexión/)
      assert.equal(h.calls.writes.length, 1)
    })
  }
})

test('mutations, RSC, assets, API, auth and other origins are not intercepted', async () => {
  const h = worker({ fetch: async () => { throw new Error('Should not fetch') } })
  for (const request of [
    navigation('/resenas/nueva', { method: 'POST' }),
    navigation('/perfil', { method: 'PUT' }),
    navigation('/fichas/123?_rsc=private', { mode: 'cors', headers: new Headers({ RSC: '1' }) }),
    navigation('/_next/static/chunks/app.js', { mode: 'no-cors' }),
    navigation('/api'),
    navigation('/api/cedula?cedula=123'),
    navigation('/auth'),
    navigation('/auth/callback?code=secret'),
    navigation('https://external.test/'),
  ]) {
    const result = await h.request(request)
    assert.equal(result.intercepted, false, request.url)
    assert.equal(result.response, undefined)
  }
  assert.equal(h.calls.fetch.length, 0)
  assert.equal(h.calls.writes.length, 0)
})

test('activation cleans only old app caches and never forces an update or navigates an open tab', async () => {
  const h = worker()
  await h.lifecycle('install')
  const current = [...h.stores.keys()][0]
  h.stores.set('protectora-offline-obsolete', new Map())
  h.stores.set('another-app-cache', new Map())
  h.stores.set('protectora-user-settings', new Map())
  await h.lifecycle('activate')
  assert.deepEqual(h.calls.deletes, ['protectora-offline-obsolete'])
  assert.deepEqual([...h.stores.keys()].sort(), [current, 'another-app-cache', 'protectora-user-settings'].sort())
  assert.equal(h.calls.claim, 1)
  assert.equal(h.calls.skipWaiting, 0)
  assert.equal(h.calls.navigate, 0)
})
