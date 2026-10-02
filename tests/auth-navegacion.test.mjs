import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { runtimeMocks } from './helpers/runtime-mocks.mjs'
import { mocksCedula } from './helpers/cedula-mocks.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const { NextRequest } = require('next/server')
const { redirect, notFound } = require('next/navigation')

function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports,
    require: name => mocks[name] ?? mocksCedula[name] ?? runtimeMocks[name] ?? require(name),
    process, crypto, Buffer, Headers, URL, URLSearchParams, console,
  })
  return mod.exports
}

function formAction(action) {
  const reports = []
  const { useFormAction: invokeWithMockedReact } = load('components/use-form-action.ts', {
    react: {
      useActionState: fn => [undefined, fn, false],
      useEffect: () => {}, useRef: () => ({ current: null }),
    },
    '@/lib/error-cliente': { registrarErrorCliente: error => reports.push(error) },
  })
  return { run: invokeWithMockedReact(action).formProps.action, reports }
}

test('successful server-action redirects escape the form wrapper without a false error', async () => {
  for (const action of [() => redirect('/admin'), () => notFound()]) {
    let expected
    try { action() } catch (error) { expected = error }
    const h = formAction(async () => { throw expected })
    await assert.rejects(h.run(undefined, new FormData()), error => error === expected)
    assert.equal(h.reports.length, 0)
  }
})

test('real network failures still preserve the retry form and report the error', async () => {
  const failure = new TypeError('Network failed')
  const h = formAction(async () => { throw failure })
  assert.match((await h.run(undefined, new FormData())).error, /Sus datos se conservan/)
  assert.deepEqual(h.reports, [failure])
})

const cacheHeaders = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0', Pragma: 'no-cache',
}

function refreshProxy({ user = { id: 'user' }, facebook = false, fail = false } = {}) {
  const helper = load('lib/supabase/proxy.ts', {
    '@supabase/ssr': {
      createServerClient: (_url, _key, { cookies }) => ({ auth: {
        getUser: async () => {
          assert.equal(cookies.getAll().find(c => c.name === 'sb-test-auth-token.0').value, 'old')
          cookies.setAll([
            { name: 'sb-test-auth-token.0', value: 'fresh', options: { path: '/', sameSite: 'lax', secure: true } },
            { name: 'sb-test-auth-token.1', value: '', options: { path: '/', maxAge: 0 } },
          ], cacheHeaders)
          // Subsequent cookie writes have no cache headers. Retain the first set.
          cookies.setAll([{ name: 'sb-test-extra', value: 'fresh', options: { path: '/' } }], {})
          assert.equal(cookies.getAll().find(c => c.name === 'sb-test-auth-token.0').value, 'fresh')
          if (fail) throw new Error('Auth unavailable after refresh')
          return { data: { user } }
        },
      } }),
    },
  })
  return load('proxy.ts', {
    '@/lib/supabase/proxy': helper,
    '@/lib/supabase/server': { sinSupabase: () => false },
    '@/lib/seo': { esEntornoIndexable: () => true },
    '@/lib/facebook-alta': { altaFacebookLista: async () => false },
    '@/lib/facebook-auth': {
      authFacebookHabilitado: () => facebook,
      cuentaCreadaConFacebook: () => facebook,
      esRutaDeAltaFacebook: () => false,
    },
    '@/lib/util': { destinoInterno: path => path },
  }).proxy
}

function request(path) {
  return new NextRequest(`https://example.test${path}`, {
    headers: { cookie: 'sb-test-auth-token.0=old; sb-test-auth-token.1=old-chunk; protectora-tema=dark' },
  })
}

function assertRefresh(response) {
  assert.equal(response.cookies.get('sb-test-auth-token.0').value, 'fresh')
  assert.equal(response.cookies.get('sb-test-auth-token.0').secure, true)
  assert.equal(response.cookies.get('sb-test-auth-token.1').maxAge, 0)
  assert.equal(response.cookies.get('sb-test-extra').value, 'fresh')
  for (const [key, value] of Object.entries(cacheHeaders)) assert.equal(response.headers.get(key), value)
  assert.ok(response.headers.get('content-security-policy').includes('nonce-'))
}

test('expired sessions refresh for both the browser and the current render on public and private pages', async () => {
  for (const path of ['/', '/login', '/admin', '/perfil']) {
    const response = await refreshProxy()(request(path))
    assert.equal(response.status, 200)
    assertRefresh(response)
    const forwarded = response.headers.get('x-middleware-request-cookie')
    assert.match(forwarded, /sb-test-auth-token.0=fresh/)
    assert.match(forwarded, /protectora-tema=dark/)
    assert.ok(response.headers.get('x-middleware-request-x-nonce'))
  }
})

test('login, onboarding and error redirects preserve refreshed cookies and cache protection', async () => {
  for (const options of [{ user: null }, { facebook: true }, { fail: true }]) {
    const response = await refreshProxy(options)(request('/admin'))
    assert.equal(response.status, 307)
    assertRefresh(response)
    assert.match(response.headers.get('location'), options.facebook ? /\/registro\/facebook/ : /\/login/)
  }
})

test('login and logout invalidate the shared layout before redirecting', async () => {
  const events = []
  const auth = load('lib/actions/auth.ts', {
    'next/cache': { revalidatePath: (...args) => events.push(['revalidate', ...args]) },
    'next/navigation': { redirect: path => { events.push(['redirect', path]); return redirect(path) } },
    'next/headers': { cookies: async () => ({ set: () => {} }) },
    '@/lib/dal': { destinoTrasLogin: async () => '/admin' },
    '@/lib/correo-recordado': { COOKIE_CORREO: 'protectora-correo' },
    '@/lib/supabase/admin': { createAdmin: () => null },
    '@/lib/supabase/server': {
      sinSupabase: () => false,
      createClient: async () => ({ auth: {
        signInWithPassword: async () => ({ data: { user: { id: 'user' } }, error: null }),
        signOut: async () => {},
      } }),
    },
    '@/lib/util': { destinoInterno: value => value || '/' },
    '@/lib/facebook-auth': {},
  })
  const data = new FormData()
  data.set('email', 'test@example.com')
  data.set('clave', 'test-password')
  await assert.rejects(auth.iniciarSesion(undefined, data), /NEXT_REDIRECT/)
  await assert.rejects(auth.cerrarSesion(), /NEXT_REDIRECT/)
  assert.deepEqual(events, [
    ['revalidate', '/', 'layout'], ['redirect', '/admin'],
    ['revalidate', '/', 'layout'], ['redirect', '/'],
  ])
})

test('PWA resources stay public during incomplete onboarding and retain registration-safe CSP', async () => {
  const proxy = refreshProxy({ facebook: true })
  for (const path of ['/manifest.webmanifest', '/sw.js', '/offline.html']) {
    const response = await proxy(request(path))
    assert.equal(response.status, 200, path)
    assert.equal(response.headers.get('location'), null, path)
    assert.equal(response.headers.get('set-cookie'), null, path)
    const csp = response.headers.get('content-security-policy')
    assert.match(csp, /(?:^|; )worker-src 'self'(?:;|$)/)
    assert.match(csp, /(?:^|; )manifest-src 'self'(?:;|$)/)
    assert.match(csp, /'nonce-[^']+'/)
    assert.match(csp, /'strict-dynamic'/)
  }
})

test('normal pages permit same-origin service worker registration without weakening script CSP', async () => {
  const response = await refreshProxy()(request('/'))
  const csp = response.headers.get('content-security-policy')
  assert.match(csp, /(?:^|; )worker-src 'self'(?:;|$)/)
  const scripts = csp.split('; ').find(directive => directive.startsWith('script-src '))
  assert.match(scripts, /'nonce-[^']+'/)
  assert.match(scripts, /'strict-dynamic'/)
  assert.doesNotMatch(scripts, /'unsafe-inline'/)
})
