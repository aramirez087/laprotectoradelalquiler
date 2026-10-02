import assert from 'node:assert/strict'
import test from 'node:test'
import { diagnosticoErrorCliente } from '../lib/diagnostico-error-cliente.ts'
import { cargarTS } from './helpers/cedula-mocks.mjs'

const origen = 'https://protectora.test'

test('WebKit and Chromium source locations survive deployment queries without exposing URLs or messages', () => {
  for (const stack of [
    `accionPrivada@${origen}/_next/static/chunks/app-abcd.js?dpl=deployment-secret:1:42`,
    `TypeError: Private tenant data\n    at accionPrivada (${origen}/_next/static/chunks/app-abcd.js?token=secret:1:42)`,
  ]) {
    const datos = diagnosticoErrorCliente({ name: 'TypeError', message: 'Private tenant data', stack }, {}, origen)
    assert.deepEqual(datos.frames, ['/_next/static/chunks/app-abcd.js:1:42'])
    assert.equal(datos.diagnostico.fuente, 'app')
    assert.equal(datos.diagnostico.tienePila, true)
    for (const privado of ['Private', 'accionPrivada', 'secret', 'protectora.test', '?']) assert.ok(!JSON.stringify(datos).includes(privado))
  }
})

test('error event filename recovers location without a stack, and third-party sources stay categorical', () => {
  const error = { name: 'TypeError', message: 'Load failed' }
  const contexto = { evento: 'error', archivo: `${origen}/_next/static/chunks/app.js?secret=123`, linea: 12, columna: 34 }
  const datos = diagnosticoErrorCliente(error, contexto, origen)
  assert.deepEqual(datos.frames, ['/_next/static/chunks/app.js:12:34'])
  assert.deepEqual(datos.diagnostico, { categoria: 'network', fuente: 'app', evento: 'error', tienePila: false })
  for (const [archivo, fuente] of [
    ['safari-web-extension://private-extension/code.js', 'extension'],
    ['https://other.test/_next/static/chunks/private.js', 'external'],
    [`${origen}/fichas/102340567?token=secret`, 'inline'],
    ['data:text/javascript,private', 'unknown'],
  ]) {
    const resultado = diagnosticoErrorCliente(error, { ...contexto, archivo }, origen)
    assert.equal(resultado.diagnostico.fuente, fuente)
    assert.deepEqual(resultado.frames, [])
    assert.ok(!JSON.stringify(resultado).includes('private'))
    assert.ok(!JSON.stringify(resultado).includes('102340567'))
  }
})

test('reporting keeps the request bounded and absorbs failures in diagnostic extraction or delivery', async () => {
  const enviados = []
  function cliente(fetch) {
    return cargarTS('lib/error-cliente.ts', {}, {
      window: { location: { origin: origen, pathname: '/fichas/102340567' } },
      navigator: { onLine: false }, fetch,
    })
  }
  const reportero = cliente(async (_, options) => { enviados.push(options.body); throw new Error('offline') })
  reportero.registrarErrorCliente({ name: 'TypeError', message: 'Load failed', stack: Array.from({ length: 8 }, (_, i) =>
    `func@${origen}/_next/static/chunks/${'a'.repeat(110)}${i}.js?private=secret:123:456`).join('\n') },
  'navegador', { evento: 'unhandledrejection' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(enviados.length, 1)
  assert.ok(Buffer.byteLength(enviados[0]) <= 1024)
  const datos = JSON.parse(enviados[0])
  assert.equal(datos.diagnostico.enLinea, false)
  assert.equal(datos.diagnostico.evento, 'unhandledrejection')
  assert.equal(datos.frames.length, 3)
  assert.equal(datos.ruta, '/fichas/[id]')
  assert.ok(!enviados[0].includes('secret'))
  const hostil = { get stack() { throw new Error('unreadable error') } }
  assert.doesNotThrow(() => cliente(() => { throw new Error('fetch unavailable') }).registrarErrorCliente(hostil, 'navegador'))
  assert.doesNotThrow(() => cliente(() => { throw new Error('fetch unavailable') }).registrarErrorCliente(new Error('test'), 'navegador'))
})

test('endpoint validates diagnostic categories and excludes arbitrary extra fields', async () => {
  const logs = []
  const api = cargarTS('app/api/errores/route.ts', { '@/lib/registro-error': { registrarError: (...args) => logs.push(args) } })
  const diagnostico = { categoria: 'network', fuente: 'unknown', evento: 'unhandledrejection', tienePila: false, enLinea: true }
  const enviar = datos => api.POST(new Request(`${origen}/api/errores`, {
    method: 'POST', headers: { origin: origen, 'content-type': 'application/json' },
    body: JSON.stringify({ origen: 'navegador', nombre: 'TypeError', ruta: '/', ...datos }),
  }))
  assert.equal((await enviar({ diagnostico: { ...diagnostico, message: 'Private tenant data', url: 'https://secret.test' } })).status, 204)
  assert.deepEqual(JSON.parse(JSON.stringify(logs[0][2].clientDiagnostic)), diagnostico)
  for (const invalido of [null, { ...diagnostico, categoria: 'private' }, { ...diagnostico, fuente: 'https://secret.test' },
    { ...diagnostico, evento: 'private' }, { ...diagnostico, tienePila: 'private' }, { ...diagnostico, enLinea: 'private' }]) {
    assert.equal((await enviar({ diagnostico: invalido })).status, 400)
  }
  // Already-open browser tabs can still send the previous payload format.
  assert.equal((await enviar({})).status, 204)
  assert.equal(logs.length, 2)
  assert.ok(!JSON.stringify(logs).includes('Private'))
})

test('global listeners preserve the error event source and distinguish promise rejections', () => {
  const listeners = new Map(), reports = [], avisos = []
  cargarTS('instrumentation-client.ts', { '@/lib/error-cliente': { registrarErrorCliente: (...args) => reports.push(args) } }, {
    window: { addEventListener: (name, fn) => listeners.set(name, fn), dispatchEvent: e => avisos.push(e.type) }, Event,
  })
  listeners.get('error')({ error: new TypeError('Load failed'), filename: 'https://other.test/code.js', lineno: 10, colno: 2 })
  listeners.get('unhandledrejection')({ reason: new TypeError('Load failed') })
  assert.equal(reports[0][2].archivo, 'https://other.test/code.js')
  assert.equal(reports[0][2].evento, 'error')
  assert.equal(reports[1][2].evento, 'unhandledrejection')
  assert.deepEqual(avisos, ['protectora:error-cliente', 'protectora:error-cliente'])
})
