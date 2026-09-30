import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { registrarError } from '../lib/registro-error.ts'
import { onRequestError } from '../instrumentation.ts'
import { cargarTS } from './helpers/cedula-mocks.mjs'
import { esOrigenPropio } from '../lib/origen.ts'

test('same-origin API checks work behind Next internal URLs without trusting forwarded-host', () => {
  const request = (origin, extra = {}) => new Request('http://localhost:3100/api/errores', {
    headers: { origin, host: 'www.protectoradelalquiler.com', 'x-forwarded-proto': 'https', ...extra },
  })
  assert.equal(esOrigenPropio(request('https://www.protectoradelalquiler.com')), true)
  assert.equal(esOrigenPropio(request('https://evil.test', { 'x-forwarded-host': 'evil.test' })), false)
  assert.equal(esOrigenPropio(request('http://www.protectoradelalquiler.com')), false)
  assert.equal(esOrigenPropio(request('not-a-url')), false)
})

test('production logs correlate Next digests without exposing query strings, headers or error messages', () => {
  const entradas = []
  const anterior = console.error
  console.error = linea => entradas.push(JSON.parse(linea))
  try {
    onRequestError({ name: 'Error', message: 'Secret tenant data', digest: '12345@E394', code: '42501',
      details: 'Private SQL details', stack: 'Secret tenant data\n    at PersonaPrivada (/repo/lib/dal.ts:10:2)' },
    { method: 'GET', path: '/fichas?q=102340567', headers: { cookie: 'secret-session' } },
    { routePath: '/fichas', routeType: 'render' })
    assert.equal(entradas[0].reference, '12345@E394')
    assert.equal(entradas[0].code, '42501')
    assert.deepEqual(entradas[0].frames, ['lib/dal.ts:10:2'])
    const texto = JSON.stringify(entradas)
    for (const privado of ['102340567', 'secret-session', 'Secret tenant data', 'Private SQL details', 'PersonaPrivada']) assert.ok(!texto.includes(privado))
    assert.match(registrarError('test_error', null), /^[a-f0-9-]{36}$/)
  } finally { console.error = anterior }
})

test('browser error endpoint rejects foreign origins and oversized bodies and logs only allowlisted diagnostics', async () => {
  const logs = []
  const api = cargarTS('app/api/errores/route.ts', { '@/lib/registro-error': { registrarError: (...args) => logs.push(args) } })
  const request = (data, origin = 'https://protectora.test') => new Request('https://protectora.test/api/errores', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: data,
  })
  assert.equal((await api.POST(request('{}', 'https://evil.test'))).status, 403)
  assert.equal((await api.POST(request('x'.repeat(1025)))).status, 413)
  assert.equal((await api.POST(request('{broken'))).status, 400)
  assert.equal((await api.POST(request(JSON.stringify({ origen: 'navegador', nombre: 'Error', digest: 'TenantName' })))).status, 400)
  const ok = await api.POST(request(JSON.stringify({ origen: 'limite', nombre: 'TypeError', digest: '12345@E394',
    message: 'Private tenant data', cedula: '102340567', cookie: 'secret' })))
  assert.equal(ok.status, 204)
  assert.equal(ok.headers.get('cache-control'), 'no-store')
  assert.equal(logs.length, 1)
  assert.deepEqual(JSON.parse(JSON.stringify(logs[0][1])), { name: 'TypeError', digest: '12345@E394' })
  for (let i = 0; i < 65; i++) await api.POST(request('{broken'))
  assert.equal((await api.POST(request('{}'))).status, 429)
})

test('route and root-layout error fallbacks share recovery and never display the original error message', () => {
  const icono = cargarTS('components/icono.tsx')
  const { default: ErrorPagina } = cargarTS('app/error.tsx', { '@/components/icono': icono })
  const { default: ErrorGlobal } = cargarTS('app/global-error.tsx', { './error': ErrorPagina, './globals.css': {} })
  const props = { error: Object.assign(new Error('Private SQL error'), { digest: '12345' }), retry() {} }
  const html = renderToStaticMarkup(createElement(ErrorGlobal, props))
  assert.match(html, /<html lang="es-CR"/)
  assert.match(html, /No pudimos cargar esta página/)
  assert.match(html, /Referencia para soporte: 12345/)
  assert.match(html, /Volver a intentar/)
  assert.match(html, /Volver al inicio/)
  assert.ok(!html.includes('Private SQL error'))
})
