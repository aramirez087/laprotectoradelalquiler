import { runtimeMocks } from './helpers/runtime-mocks.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const code = ts.transpileModule(readFileSync('lib/actions/auth.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function recovery(options = {}) {
  const calls = [], logs = []
  const mod = { exports: {} }
  const mocks = {
    'next/headers': { headers: async () => new Headers(options.headers ?? { host: 'www.protectoradelalquiler.com' }) },
    'next/navigation': { unstable_rethrow: error => { if (error?.framework) throw error } },
    '@/lib/supabase/admin': { createAdmin: () => { throw new Error('Recovery must not look up account existence') } },
    '@/lib/supabase/server': {
      sinSupabase: () => false,
      createClient: async () => ({ auth: {
        resetPasswordForEmail: async (email, parameters) => {
          calls.push({ email, parameters })
          if (options.thrown) throw options.thrown
          return { data: options.data ?? {}, error: options.error ?? null }
        },
      } }),
    },
  }
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports,
    require: name => name in mocks ? mocks[name] : name.startsWith('@/') ? {} : (runtimeMocks[name] ?? require(name)),
    console: { error: (...args) => logs.push(JSON.parse(JSON.stringify(args))) },
  })
  const submit = async (email = 'account@example.test') => {
    const data = new FormData()
    if (email !== undefined) data.set('email', email)
    return mod.exports.solicitarRecuperacion(undefined, data)
  }
  return { submit, calls, logs }
}

test('recovery normalizes email and uses the public callback through proxy headers', async () => {
  const h = recovery({ headers: {
    host: 'internal.local:3000',
    'x-forwarded-host': 'www.protectoradelalquiler.com, internal.local:3000',
    'x-forwarded-proto': 'https, http',
  } })
  const result = await h.submit('  Account@Example.TEST  ')
  assert.ok(result.mensaje)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].email, 'account@example.test')
  assert.equal(h.calls[0].parameters.redirectTo, 'https://www.protectoradelalquiler.com/auth/confirmar?next=/restablecer')
  assert.equal(h.logs.length, 0)
})

test('recovery preserves host fallback and local development callback behavior', async () => {
  for (const [host, origin] of [
    ['www.protectoradelalquiler.com', 'https://www.protectoradelalquiler.com'],
    ['localhost:3000', 'http://localhost:3000'],
    ['127.0.0.1:3000', 'http://127.0.0.1:3000'],
  ]) {
    const h = recovery({ headers: { host } })
    await h.submit()
    assert.equal(h.calls[0].parameters.redirectTo, `${origin}/auth/confirmar?next=/restablecer`)
  }
  const missing = recovery({ headers: {} })
  assert.ok((await missing.submit()).error)
  assert.equal(missing.calls.length, 0)
})

test('SMTP and unauthorized-recipient errors never claim a recovery email was sent', async () => {
  const messages = []
  for (const error of [
    { code: 'unexpected_failure', status: 500, message: 'SMTP rejected account@example.test with token=secret' },
    { code: 'email_address_not_authorized', status: 403, message: 'Email address not authorized: account@example.test' },
  ]) {
    const h = recovery({ error })
    const result = await h.submit()
    assert.ok(result.error)
    assert.equal(result.mensaje, undefined)
    assert.equal(h.calls.length, 1)
    assert.deepEqual(h.logs, [['recuperacion_clave_error', { code: error.code, status: error.status }]])
    assert.doesNotMatch(JSON.stringify([result, h.logs]), /account@example|secret|SMTP|not authorized/)
    messages.push(result.error)
  }
  assert.equal(messages[0], messages[1], 'operational failures do not disclose account details')
})

test('structured rate-limit errors show retry guidance independently of message wording', async () => {
  for (const error of [
    { code: 'over_email_send_rate_limit', status: 429, message: 'For security purposes, you can only request this after 60 seconds.' },
    { code: 'over_request_rate_limit', message: 'Demasiadas solicitudes' },
    { code: 'over_email_send_rate_limit', message: 'Please wait' },
    { status: 429, message: 'Limit exceeded' },
  ]) {
    const h = recovery({ error })
    const result = await h.submit()
    assert.match(result.error, /Espere al menos un minuto/)
    assert.equal(result.mensaje, undefined)
    assert.equal(h.calls.length, 1, 'do not retry an email request automatically')
  }
})

test('thrown network failures are recoverable and do not leak error contents or retry sends', async () => {
  const h = recovery({ thrown: new Error('Network failed for account@example.test using token=secret') })
  const result = await h.submit()
  assert.ok(result.error)
  assert.equal(result.mensaje, undefined)
  assert.equal(h.calls.length, 1)
  assert.deepEqual(h.logs, [['recuperacion_clave_error', { code: 'unknown', status: null }]])
  assert.doesNotMatch(JSON.stringify([result, h.logs]), /account@example|secret|Network/)
})

test('successful requests and unknown accounts keep the same nondisclosing response', async () => {
  const responses = []
  for (const email of ['existing@example.test', 'unknown@example.test']) {
    const h = recovery()
    const result = await h.submit(email)
    assert.equal(result.error, undefined)
    assert.equal(result.mensaje, 'Solicitud recibida. Si el correo corresponde a una cuenta, revise su bandeja de entrada para continuar.')
    assert.equal(h.logs.length, 0)
    responses.push(result.mensaje)
  }
  assert.equal(responses[0], responses[1])
})

test('invalid inputs are rejected before contacting Auth and malformed diagnostic values are discarded', async () => {
  for (const email of ['', 'invalid', new Blob(['not an email'])]) {
    const h = recovery()
    assert.ok((await h.submit(email)).error)
    assert.equal(h.calls.length, 0)
    assert.equal(h.logs.length, 0)
  }
  const h = recovery({ error: { code: 'secret@example.test token=secret', status: '500 token=secret', message: 'secret' } })
  await h.submit()
  assert.deepEqual(h.logs, [['recuperacion_clave_error', { code: 'unknown', status: null }]])
})

test('Next framework interrupts are rethrown before recovery error handling', async () => {
  const interrupt = { framework: true }
  const h = recovery({ thrown: interrupt })
  await assert.rejects(h.submit(), error => error === interrupt)
  assert.equal(h.logs.length, 0)
})
