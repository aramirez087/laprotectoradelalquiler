import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { runtimeMocks } from './helpers/runtime-mocks.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const resolve = name => name in mocks ? mocks[name]
    : name in runtimeMocks ? runtimeMocks[name]
      : name.startsWith('@/') ? load(`${name.slice(2)}.ts`, mocks) : require(name)
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, require: resolve,
    process, console, crypto, Buffer, Headers, URL, URLSearchParams,
  }, { filename: file })
  return mod.exports
}

function callback(options = {}) {
  const calls = []
  const user = options.user ?? { id: 'auth-27', email: 'member@example.test' }
  const GET = load('app/auth/confirmar/route.ts', {
    '@/lib/facebook-alta': {
      altaFacebookLista: async () => false,
      vincularCuentaListaPorCorreo: async () => false,
    },
    '@/lib/facebook-auth': {
      authFacebookHabilitado: () => true,
      cuentaCreadaConFacebook: () => false,
      destinoTrasEntrarConFacebook: path => path,
      rutaTrasFalloFacebook: () => '/login?facebook=error',
    },
    '@/lib/dos-factores': {
      requiereSegundoFactor: async () => Boolean(options.mfa),
      rutaSegundoFactor: runtimeMocks['@/lib/dos-factores'].rutaSegundoFactor,
    },
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      exchangeCodeForSession: async (code, parameters) => {
        calls.push(['exchange', code, parameters])
        if (options.thrown) throw options.thrown
        return { data: { user, redirectType: options.redirectType ?? null }, error: options.error ?? null }
      },
      verifyOtp: async parameters => {
        calls.push(['verify', parameters])
        if (options.thrown) throw options.thrown
        return { data: { user }, error: options.error ?? null }
      },
      getUser: async () => ({ data: { user } }),
    } }) },
  }).GET
  const open = async query => {
    const response = await GET(new Request(`https://www.protectoradelalquiler.com/auth/confirmar${query}`))
    return { response, destination: new URL(response.headers.get('location')) }
  }
  return { open, calls }
}

function assertPrivateRedirect(response) {
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  assert.equal(response.status, 307)
}

test('recovery tokens always open the password form even when the supplied next points home or onboarding', async () => {
  for (const next of ['/', '/registro/resena', 'https://evil.test']) {
    const h = callback()
    const { response, destination } = await h.open(`?token_hash=secret&type=recovery&next=${encodeURIComponent(next)}`)
    assert.equal(destination.pathname, '/restablecer')
    assert.equal(destination.search, '')
    assert.equal(destination.hash, '')
    assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [['verify', { type: 'recovery', token_hash: 'secret' }]])
    assertPrivateRedirect(response)
  }
})

test('PKCE recovery metadata determines the destination and the flow id reaches Supabase', async () => {
  const h = callback({ redirectType: 'recovery' })
  const { response, destination } = await h.open('?code=secret&next=/&sb_flow_id=flow-27')
  assert.equal(destination.pathname, '/restablecer')
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [['exchange', 'secret', { flowId: 'flow-27' }]])
  assertPrivateRedirect(response)
})

test('a recovered account retains its review destination through reset and MFA', async () => {
  for (const mfa of [false, true]) {
    const h = callback({ mfa, redirectType: 'recovery' })
    const { destination } = await h.open(`?code=secret&next=/&siguiente=${encodeURIComponent('/resenas/nueva?ficha=27')}`)
    const reset = mfa ? new URL(destination.searchParams.get('siguiente'), destination.origin) : destination
    assert.equal(destination.pathname, mfa ? '/login/verificar' : '/restablecer')
    assert.equal(reset.pathname, '/restablecer')
    assert.equal(reset.searchParams.get('siguiente'), '/resenas/nueva?ficha=27')
    const unsafe = await h.open('?code=secret&siguiente=https://evil.test')
    assert.doesNotMatch(unsafe.destination.href, /evil\.test/)
  }
})

test('email confirmation defaults to the first review and other email links default home', async () => {
  for (const [type, expected] of [
    ['signup', '/registro/resena'], ['email', '/registro/resena'],
    ['invite', '/'], ['magiclink', '/'], ['email_change', '/'],
  ]) {
    const h = callback()
    const { destination, response } = await h.open(`?token_hash=secret&type=${type}`)
    assert.equal(destination.pathname, expected, type)
    assertPrivateRedirect(response)
  }
})

test('ordinary confirmation preserves a safe next without exposing tokens in its final URL', async () => {
  for (const [next, expected] of [
    ['/perfil#mis-resenas', '/perfil#mis-resenas'], ['/resenas/nueva?ficha=27', '/resenas/nueva?ficha=27'],
    ['https://evil.test', '/registro/resena'], ['//evil.test', '/registro/resena'], ['/\\evil.test', '/registro/resena'],
  ]) {
    const { destination } = await callback().open(`?token_hash=secret&type=signup&next=${encodeURIComponent(next)}`)
    assert.equal(destination.pathname + destination.search + destination.hash, expected)
    assert.doesNotMatch(destination.href, /secret|token_hash|evil/)
  }
})

test('expired recovery and confirmation links provide separate retry paths without token leaks', async () => {
  for (const [type, expected, error] of [
    ['recovery', '/recuperar', 'enlace'], ['signup', '/login', 'confirmacion'], ['email', '/login', 'confirmacion'],
  ]) {
    const h = callback({ error: { code: 'otp_expired', message: 'token_hash=secret member@example.test' } })
    const { destination, response } = await h.open(`?token_hash=secret&type=${type}`)
    assert.equal(destination.pathname, expected)
    assert.equal(destination.searchParams.get('error'), error)
    assert.doesNotMatch(destination.href, /secret|member|otp_expired/)
    assertPrivateRedirect(response)
  }
})

test('missing tokens and unsupported OTP types never contact the verification endpoint', async () => {
  for (const query of ['', '?token_hash=secret&type=sms', '?type=recovery']) {
    const h = callback()
    const { destination } = await h.open(query)
    assert.equal(destination.pathname, '/recuperar')
    assert.equal(destination.searchParams.get('error'), 'enlace')
    assert.equal(h.calls.length, 0)
  }
})

test('Auth network failures leave a usable retry route instead of a callback server error', async () => {
  for (const [query, expected] of [
    ['?token_hash=secret&type=recovery', '/recuperar'], ['?token_hash=secret&type=signup', '/login'],
  ]) {
    const h = callback({ thrown: new TypeError('Network failure token=secret') })
    const { destination, response } = await h.open(query)
    assert.equal(destination.pathname, expected)
    assert.doesNotMatch(destination.href, /secret|Network/)
    assertPrivateRedirect(response)
  }
})

test('recovery failure takes precedence over a misleading onboarding next and retains only a safe continuation', async () => {
  for (const siguiente of ['/resenas/nueva?ficha=27', 'https://evil.test']) {
    const h = callback({ error: { code: 'otp_expired' } })
    const { destination } = await h.open(`?token_hash=secret&type=recovery&next=/registro/resena&siguiente=${encodeURIComponent(siguiente)}`)
    assert.equal(destination.pathname, '/recuperar')
    assert.equal(destination.searchParams.get('error'), 'enlace')
    assert.equal(destination.searchParams.get('siguiente'), siguiente.startsWith('/') ? siguiente : null)
    assert.doesNotMatch(destination.href, /evil\.test|secret/)
  }
})
