import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import * as audiencia from '../lib/audiencia.ts'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const code = ts.transpileModule(readFileSync('components/audiencia.tsx', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText
const settle = () => new Promise(resolve => setImmediate(resolve))

// Exercise the real effect and delegated handlers without loading a browser or sending traffic.
function collector({configured = true, hidden = false, dnt = false, gpc = false, delayed = false, storageBlocked = false} = {}) {
  const refs = []
  let refIndex = 0
  let path = '/'
  let cleanup
  let marker = null
  let sdkFailure = null
  let completeInitialization
  const listeners = new Map()
  const observers = []
  const events = []
  const clients = []
  const navigator = {doNotTrack: dnt ? '1' : '0', globalPrivacyControl: gpc, userAgent: 'Mobile'}
  const storage = new Map()
  const browserStorage = {
    getItem: key => { if (storageBlocked) throw new Error('Blocked'); return storage.get(key) ?? null },
    setItem: (key, value) => { if (storageBlocked) throw new Error('Blocked'); storage.set(key, value) },
  }
  class Element {
    constructor(value, visible = true) { this.value = value; this.visible = visible }
    closest(selector) { assert.equal(selector, '[data-evento-publico]'); return this }
    getAttribute(name) { assert.equal(name, 'data-evento-publico'); return this.value }
    getClientRects() { return this.visible ? [{}] : [] }
  }
  const document = {
    visibilityState: hidden ? 'hidden' : 'visible',
    referrer: 'https://www.google.co.cr/search?q=private',
    body: {},
    querySelector(selector) {
      assert.equal(selector, '[data-visita-publica="registro_desde_ejemplo"]')
      return marker
    },
    addEventListener(name, handler) {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(handler)
    },
    removeEventListener(name, handler) { listeners.get(name)?.delete(handler) },
  }
  class MutationObserver {
    constructor(callback) { this.callback = callback; this.active = false; observers.push(this) }
    observe() { this.active = true }
    disconnect() { this.active = false }
  }
  class StatsigClient {
    constructor(key, user, options) { clients.push({key, user, options}) }
    initializeAsync() {
      if (sdkFailure === 'initialize') return Promise.reject(new Error('Unavailable'))
      return delayed ? new Promise(resolve => { completeInitialization = resolve }) : Promise.resolve()
    }
    logEvent(...args) {
      if (sdkFailure === 'log') throw new Error('Logging failed')
      assert.equal(args.length, 1, 'no metadata, values or URLs are sent')
      events.push(args[0])
    }
  }
  const compiled = {exports: {}}
  vm.runInNewContext(code, {
    module: compiled, exports: compiled.exports, Date, Set, Element, MutationObserver,
    navigator, document, location: {origin: 'https://protectoradelalquiler.com'},
    localStorage: browserStorage, sessionStorage: browserStorage,
    crypto: {randomUUID: () => '11111111-1111-4111-8111-111111111111'},
    process: {env: configured ? {NEXT_PUBLIC_STATSIG_CLIENT_KEY: 'public-test-key'} : {}},
    require: name => {
      if (name === 'react') return {
        useRef(initial) { const index = refIndex++; refs[index] ??= {current: initial}; return refs[index] },
        useEffect(effect) { cleanup = effect() },
      }
      if (name === 'next/navigation') return {usePathname: () => path}
      if (name === '@/lib/audiencia') return audiencia
      if (name === '@statsig/js-client') {
        if (sdkFailure === 'import') throw new Error('SDK blocked')
        return {StatsigClient}
      }
      return require(name)
    },
  })
  const dispatch = (name, event = {}) => {
    for (const listener of [...listeners.get(name) ?? []]) listener(event)
  }
  return {
    events, clients, navigator,
    render(nextPath, props = {}) {
      cleanup?.()
      path = nextPath
      refIndex = 0
      compiled.exports.Audiencia({habilitada: true, administra: false, ...props})
    },
    click(value, button = 0) {
      dispatch('click', {target: new Element(value), button,
        preventDefault() { assert.fail('analytics must never prevent navigation') },
      })
    },
    visibility(value) { document.visibilityState = value; dispatch('visibilitychange') },
    marker(visible = true) { marker = new Element('registro_desde_ejemplo', visible) },
    mutate() { for (const observer of observers) if (observer.active) observer.callback() },
    fail(failure) { sdkFailure = failure },
    initialize() { completeInitialization?.() },
    dispose() { cleanup?.() },
  }
}

test('one fixed event per actual visit survives repeated clicks and remounted effects', async () => {
  const h = collector()
  h.render('/')
  h.click('inicio_ejemplo')
  h.click('inicio_ejemplo')
  h.render('/') // Strict Mode remounts the effect without creating another page visit.
  await settle()
  assert.equal(h.events.filter(v => v === 'site_page_inicio').length, 1)
  assert.equal(h.events.filter(v => v === 'site_public_inicio_ejemplo').length, 1)
  h.render('/ejemplo')
  for (const event of ['ejemplo_con_resenas', 'ejemplo_sin_resultados', 'ejemplo_registro']) {
    h.click(event)
    h.click(event)
  }
  h.click('inicio_ejemplo')
  h.click('private@example.test')
  h.click('registro_desde_ejemplo')
  h.click('ejemplo_registro', 1)
  await settle()
  assert.deepEqual(h.events.filter(v => v.startsWith('site_public_ejemplo')), [
    'site_public_ejemplo_con_resenas', 'site_public_ejemplo_sin_resultados', 'site_public_ejemplo_registro',
  ])
  h.visibility('hidden')
  h.visibility('visible')
  await settle()
  assert.equal(h.events.filter(v => v === 'site_page_ejemplo').length, 1)
  h.render('/admin')
  h.click('ejemplo_registro')
  h.render('/')
  h.click('inicio_ejemplo')
  await settle()
  assert.equal(h.events.filter(v => v === 'site_page_inicio').length, 2)
  assert.equal(h.events.filter(v => v === 'site_public_inicio_ejemplo').length, 2)
  assert.equal(h.clients[0].options.includeCurrentPageUrlWithEvents, false)
  assert.deepEqual(Object.keys(h.clients[0].user), ['userID'])
  assert.equal(h.events.some(v => /@|\?|https:|private/.test(v)), false)
  h.dispose()
})

test('guide registration clicks stay separate from conversions and only log on the matching page', async () => {
  const h = collector()
  h.render('/guias/referencias-de-inquilinos')
  h.click('guia_referencias_registro')
  h.click('guia_referencias_registro')
  h.click('guia_preguntas_registro')
  await settle()
  assert.equal(h.events.filter(v => v === 'site_page_guia_referencias').length, 1)
  assert.deepEqual(h.events.filter(v => v.startsWith('site_public_')), ['site_public_guia_referencias_registro'])
  h.render('/registro')
  await settle()
  assert.equal(h.events.some(v => v.includes('aprobacion') || v.includes('registro_desde')), false)
  h.dispose()
})

test('production, administrator, key and browser privacy gates also prevent SDK loading for public clicks', async () => {
  for (const [options, props] of [
    [{}, {habilitada: false}], [{}, {administra: true}], [{configured: false}, {}],
    [{dnt: true}, {}], [{gpc: true}, {}], [{hidden: true}, {}],
  ]) {
    const h = collector(options)
    h.render('/ejemplo', props)
    h.click('ejemplo_registro')
    await settle()
    assert.equal(h.clients.length, 0)
    assert.deepEqual(h.events, [])
    h.dispose()
  }
})

test('hidden visits wait for visibility and delayed initialization rechecks privacy', async () => {
  const h = collector({hidden: true, delayed: true})
  h.render('/ejemplo')
  await settle()
  assert.equal(h.clients.length, 0)
  h.visibility('visible')
  h.click('ejemplo_registro')
  await settle()
  assert.equal(h.clients.length, 1)
  h.navigator.globalPrivacyControl = true
  h.initialize()
  await settle()
  assert.deepEqual(h.events, [])
  h.dispose()
})

test('queued events survive navigation without waiting and are dropped when eligibility changes', async () => {
  const navigation = collector({delayed: true})
  navigation.render('/ejemplo')
  navigation.click('ejemplo_registro')
  navigation.render('/registro')
  await settle()
  assert.equal(navigation.clients.length, 1)
  assert.deepEqual(navigation.events, [])
  navigation.initialize()
  await settle()
  assert.equal(navigation.events.filter(v => v === 'site_public_ejemplo_registro').length, 1)
  assert.equal(navigation.events.filter(v => v === 'site_page_registro').length, 1)
  navigation.dispose()

  for (const change of [
    h => h.visibility('hidden'),
    h => { h.navigator.doNotTrack = '1' },
    h => h.render('/ejemplo', {administra: true}),
    h => h.render('/ejemplo', {habilitada: false}),
  ]) {
    const h = collector({delayed: true})
    h.render('/ejemplo')
    h.click('ejemplo_registro')
    await settle()
    change(h)
    h.initialize()
    await settle()
    assert.deepEqual(h.events, [])
    h.dispose()
  }
})

test('registration arrivals need a rendered marker and visible document, never merely a CTA click', async () => {
  const h = collector()
  h.render('/ejemplo')
  h.click('ejemplo_registro')
  await settle()
  assert.equal(h.events.includes('site_public_registro_desde_ejemplo'), false)
  h.render('/registro')
  await settle()
  assert.equal(h.events.includes('site_public_registro_desde_ejemplo'), false)
  h.marker(false)
  h.mutate()
  await settle()
  assert.equal(h.events.includes('site_public_registro_desde_ejemplo'), false)
  h.visibility('hidden')
  h.marker()
  h.mutate()
  await settle()
  assert.equal(h.events.includes('site_public_registro_desde_ejemplo'), false)
  h.visibility('visible')
  h.mutate()
  h.mutate()
  await settle()
  assert.equal(h.events.filter(v => v === 'site_public_registro_desde_ejemplo').length, 1)
  h.render('/registro')
  await settle()
  assert.equal(h.events.filter(v => v === 'site_public_registro_desde_ejemplo').length, 1)
  h.dispose()
})

test('SDK import, initialization and event failures never disrupt clicks and permit later retry', async () => {
  for (const failure of ['import', 'initialize', 'log']) {
    const h = collector({storageBlocked: true})
    h.fail(failure)
    h.render('/ejemplo')
    assert.doesNotThrow(() => h.click('ejemplo_registro'))
    await settle()
    assert.deepEqual(h.events, [])
    h.fail(null)
    h.click('ejemplo_registro')
    await settle()
    assert.equal(h.events.filter(v => v === 'site_public_ejemplo_registro').length, 1)
    h.dispose()
  }
})
