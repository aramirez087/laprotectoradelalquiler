import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'

const require = createRequire(import.meta.url)
const ts = require('typescript')
function correo(env = {}, responses = []) {
  const calls = [], waits = []
  const mod = { exports: {} }
  const code = ts.transpileModule(readFileSync('lib/correo-resenas.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mocks = { 'server-only': {}, 'node:timers/promises': { setTimeout: async (ms) => waits.push(ms) } }
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, process: { env }, AbortSignal,
    require: (name) => mocks[name] ?? require(name),
    fetch: async (url, options) => {
      calls.push({ url, ...options })
      const r = responses.shift() ?? { status: 200, body: { id: 'email-id' } }
      if (r instanceof Error) throw r
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body }
    },
  })
  return { ...mod.exports, calls, waits }
}
const input = { solicitada: true, accion: 'modificada', resenaId: 42, autor: { email: 'writer@example.com', nombre: 'Author' } }

test('without configuration the feature is disabled and a forged checkbox cannot send', async () => {
  const c = correo()
  assert.equal(c.correoResenasConfigurado(), false)
  assert.match((await c.notificarCambioResena(input)).advertencia, /no está configurado/)
  assert.equal(c.calls.length, 0)
})
test('configured but unchecked notifications never contact Resend', async () => {
  const c = correo({ RESEND_API_KEY: 'fake-key' })
  assert.equal(c.correoResenasConfigurado(), true)
  assert.equal((await c.notificarCambioResena({ ...input, solicitada: false })).mensaje, undefined)
  assert.equal(c.calls.length, 0)
})
test('edit and delete notices use server configuration, plain text and a profile link', async () => {
  const c = correo({ RESEND_API_KEY: 'fake-key', RESEND_FROM_EMAIL: 'Test <admin@verified.example>' })
  for (const accion of ['modificada', 'eliminada']) {
    assert.match((await c.notificarCambioResena({ ...input, accion })).mensaje, /enviada/)
    const request = c.calls.at(-1), payload = JSON.parse(request.body)
    assert.equal(request.url, 'https://api.resend.com/emails')
    assert.equal(request.headers.Authorization, 'Bearer fake-key')
    assert.equal(payload.from, 'Test <admin@verified.example>')
    assert.deepEqual(payload.to, ['writer@example.com'])
    assert.match(payload.subject, new RegExp(accion))
    assert.match(payload.text, /#42/)
    assert.match(payload.text, /https:\/\/www.protectoradelalquiler.com\/perfil/)
    assert.equal(payload.html, undefined)
  }
})
test('transient and network errors retry once with the identical idempotency key and payload', async () => {
  for (const first of [{ status: 503, body: {} }, { status: 429, body: {} }, new Error('response lost')]) {
    const c = correo({ RESEND_API_KEY: 'fake-key' }, [first])
    assert.ok((await c.notificarCambioResena(input)).mensaje)
    assert.equal(c.calls.length, 2)
    assert.equal(c.calls[0].headers['Idempotency-Key'], c.calls[1].headers['Idempotency-Key'])
    assert.equal(c.calls[0].body, c.calls[1].body)
    assert.equal(c.waits.length, 1)
  }
})
test('provider rejection or malformed success produces a warning, never false success', async () => {
  for (const response of [{ status: 403, body: { message: 'unverified domain' } }, { status: 200, body: {} }]) {
    const c = correo({ RESEND_API_KEY: 'fake-key' }, [response])
    const result = await c.notificarCambioResena(input)
    assert.equal(result.mensaje, undefined)
    assert.match(result.advertencia, /no pudimos confirmar/)
    assert.equal(c.calls.length, 1)
  }
})
test('legacy placeholders, erased accounts and invalid addresses are never emailed', async () => {
  const c = correo({ RESEND_API_KEY: 'fake-key' })
  for (const email of ['u42@legacy.laprotec', 'eliminada.abc@cuentas.invalid', 'invalid']) {
    assert.match((await c.notificarCambioResena({ ...input, autor: { nombre: 'Author', email } })).advertencia, /correo válido/)
  }
  assert.equal(c.calls.length, 0)
})
