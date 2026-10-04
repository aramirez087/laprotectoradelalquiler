import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { runtimeMocks } from './helpers/runtime-mocks.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')

function load(file, mocks) {
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

function redirect(path) {
  const error = new Error('redirect')
  error.path = path
  error.framework = true
  throw error
}

function actions(options = {}) {
  const calls = [], reports = []
  const user = 'user' in options ? options.user : { id: 'auth-27', email: 'member@example.test' }
  const auth = load('lib/actions/auth.ts', {
    'next/headers': {
      headers: async () => new Headers({ host: 'www.protectoradelalquiler.com' }),
      cookies: async () => ({ set: (...args) => calls.push(['cookie', ...args]) }),
    },
    'next/cache': { revalidatePath: (...args) => calls.push(['revalidate', ...args]) },
    'next/navigation': { redirect, unstable_rethrow: error => { if (error?.framework) throw error } },
    '@/lib/padron': {},
    '@/lib/facebook-auth': {},
    '@/lib/registro-error': { registrarError: event => reports.push(event) },
    '@/lib/dal': {
      requireUsuario: async () => user,
      destinoTrasLogin: async (...args) => {
        calls.push(['destination', ...args])
        if (options.destinationThrown) throw options.destinationThrown
        return options.destination ?? args[1]
      },
    },
    '@/lib/supabase/admin': { createAdmin: () => null },
    '@/lib/dos-factores': {
      requiereSegundoFactor: async () => Boolean(options.mfa),
      rutaSegundoFactor: runtimeMocks['@/lib/dos-factores'].rutaSegundoFactor,
    },
    '@/lib/supabase/server': { sinSupabase: () => false, createClient: async () => ({ auth: {
      getUser: async () => {
        if (options.sessionThrown) throw options.sessionThrown
        return { data: { user }, error: null }
      },
      signInWithPassword: async input => {
        calls.push(['login', input])
        if (options.thrown) throw options.thrown
        return { data: { user }, error: options.error ?? null }
      },
      updateUser: async input => {
        calls.push(['password', input])
        if (options.thrown) throw options.thrown
        return { data: { user }, error: options.error ?? null }
      },
      resend: async input => {
        calls.push(['confirmation', input])
        if (options.thrown) throw options.thrown
        return { data: {}, error: options.error ?? null }
      },
    } }) },
  })
  return { auth, calls, reports }
}

function form(values = {}) {
  const data = new FormData()
  for (const [name, value] of Object.entries(values)) data.set(name, value)
  return data
}

test('login normalizes pasted email and safely rejects missing or file inputs before Auth', async () => {
  const h = actions()
  await assert.rejects(h.auth.iniciarSesion(undefined, form({
    email: '  Member@Example.TEST  ', clave: 'password123', siguiente: '/resenas/nueva',
  })), error => error.path === '/resenas/nueva')
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.find(call => call[0] === 'login')[1])), {
    email: 'member@example.test', password: 'password123',
  })
  for (const email of [undefined, '', 'invalid', new Blob(['email'])]) {
    const invalid = actions()
    const result = await invalid.auth.iniciarSesion(undefined, form({ clave: 'password123', ...(email === undefined ? {} : { email }) }))
    assert.ok(result.error)
    assert.equal(invalid.calls.length, 0)
  }
})

test('login distinguishes an unconfirmed account from credentials while providing the normalized recovery email', async () => {
  for (const [code, expectedFlag] of [
    ['email_not_confirmed', 'confirmarCorreo'], ['invalid_credentials', 'recuperable'],
  ]) {
    const h = actions({ error: { code, status: 400, message: 'Localized provider message' } })
    const result = await h.auth.iniciarSesion(undefined, form({ email: 'Member@Example.TEST', clave: 'password123' }))
    assert.ok(result.error)
    assert.equal(result[expectedFlag], true)
    assert.equal(result.email, 'member@example.test')
    assert.equal(h.calls.length, 1)
  }
})

test('login network failures leave an actionable error and do not claim successful authentication', async () => {
  const h = actions({ thrown: new TypeError('failed member@example.test token=secret') })
  const result = await h.auth.iniciarSesion(undefined, form({ email: 'member@example.test', clave: 'password123' }))
  assert.ok(result.error)
  assert.equal(result.mensaje, undefined)
  assert.doesNotMatch(result.error, /member@|secret/)
  assert.equal(h.calls.length, 1)
})

test('password reset requires an active Auth session and valid matching passwords', async () => {
  const expired = actions({ user: null })
  assert.ok((await expired.auth.establecerClave(undefined, form({ clave: 'password123', confirmacion: 'password123' }))).error)
  assert.equal(expired.calls.length, 0)
  for (const [clave, confirmacion] of [['short1', 'short1'], ['password', 'password'], ['password123', 'different123']]) {
    const h = actions()
    assert.ok((await h.auth.establecerClave(undefined, form({ clave, confirmacion }))).error)
    assert.equal(h.calls.length, 0)
  }
})

test('password reset success invalidates the signed-in layout and provides a visible completion destination', async () => {
  const h = actions({ destination: '/registro/resena' })
  const result = await h.auth.establecerClave(undefined, form({
    clave: 'password123', confirmacion: 'password123', siguiente: '/resenas/nueva?ficha=27',
  }))
  assert.equal(result.mensaje, 'Su clave se actualizó. Ya puede continuar con su cuenta.')
  assert.equal(result.destino, '/registro/resena')
  assert.equal(result.error, undefined)
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [
    ['password', { password: 'password123' }],
    ['revalidate', '/', 'layout'],
    ['destination', 'auth-27', '/resenas/nueva?ficha=27'],
  ])
})

test('password reset rejects external continuation and preserves the second-factor guard', async () => {
  const h = actions()
  const result = await h.auth.establecerClave(undefined, form({
    clave: 'password123', confirmacion: 'password123', siguiente: '//evil.test',
  }))
  assert.equal(result.destino, '/')
  const mfa = actions({ mfa: true })
  await assert.rejects(mfa.auth.establecerClave(undefined, form({ clave: 'password123', confirmacion: 'password123' })),
    error => error.path.startsWith('/login/verificar?'))
  assert.equal(mfa.calls.length, 0)
})

test('password reset MFA retains the review destination and rejects an external continuation before saving', async () => {
  for (const [siguiente, expected] of [
    ['/resenas/nueva?ficha=27', '/resenas/nueva?ficha=27'], ['https://evil.test', null],
  ]) {
    const h = actions({ mfa: true })
    await assert.rejects(h.auth.establecerClave(undefined, form({
      clave: 'password123', confirmacion: 'password123', siguiente,
    })), error => {
      const verification = new URL(error.path, 'https://www.protectoradelalquiler.com')
      assert.equal(verification.pathname, '/login/verificar')
      const reset = new URL(verification.searchParams.get('siguiente'), verification.origin)
      assert.equal(reset.pathname, '/restablecer')
      assert.equal(reset.searchParams.get('siguiente'), expected)
      assert.doesNotMatch(error.path, /evil\.test/)
      return true
    })
    assert.equal(h.calls.length, 0, 'MFA must run before changing the password')
    assert.equal(h.reports.length, 0, 'The framework redirect must not become an update error')
  }
})

test('a destination lookup failure after saving retains reset success and offers the safe homepage', async () => {
  const h = actions({ destinationThrown: new TypeError('Database unavailable member@example.test token=secret') })
  const result = await h.auth.establecerClave(undefined, form({
    clave: 'password123', confirmacion: 'password123', siguiente: '/resenas/nueva?ficha=27',
  }))
  assert.equal(result.mensaje, 'Su clave se actualizó. Ya puede continuar con su cuenta.')
  assert.equal(result.destino, '/')
  assert.equal(result.error, undefined)
  assert.doesNotMatch(JSON.stringify(result), /member@|secret|Database/)
  assert.equal(h.calls.filter(call => call[0] === 'password').length, 1)
  assert.ok(h.calls.some(call => call[0] === 'revalidate'))
  assert.deepEqual(h.reports, ['password_destination_error'])
})

test('password reset errors allow a retry without updating the layout or leaking provider details', async () => {
  for (const options of [
    { error: { code: 'same_password', message: 'New password should be different from the old password.' } },
    { error: { status: 500, message: 'failed token=secret' } },
    { thrown: new TypeError('failed member@example.test token=secret') },
    { sessionThrown: new TypeError('failed member@example.test token=secret') },
  ]) {
    const h = actions(options)
    const result = await h.auth.establecerClave(undefined, form({ clave: 'password123', confirmacion: 'password123' }))
    assert.ok(result.error)
    assert.equal(result.mensaje, undefined)
    assert.doesNotMatch(result.error, /member@|secret/)
    assert.ok(!h.calls.some(call => call[0] === 'revalidate' || call[0] === 'destination'))
    if (options.error?.code === 'same_password') assert.match(result.error, /distinta/)
  }
})

test('confirmation resends normalize the email and direct users to onboarding without querying account existence', async () => {
  for (const email of ['  Member@Example.TEST  ', 'unknown@example.test']) {
    const h = actions()
    const result = await h.auth.confirmarCorreoPendiente(undefined, form({ email }))
    assert.ok(result.mensaje)
    assert.equal(result.error, undefined)
    assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [['confirmation', {
      type: 'signup', email: email.trim().toLowerCase(),
      options: { emailRedirectTo: 'https://www.protectoradelalquiler.com/auth/confirmar?next=/registro/resena' },
    }]])
  }
})

test('confirmation resend validation and delivery failures preserve the retry path', async () => {
  const invalid = actions()
  assert.ok((await invalid.auth.confirmarCorreoPendiente(undefined, form({ email: new Blob(['email']) }))).error)
  assert.equal(invalid.calls.length, 0)
  for (const options of [
    { error: { code: 'over_email_send_rate_limit', status: 429, message: 'localized' } },
    { thrown: new TypeError('failed member@example.test token=secret') },
  ]) {
    const h = actions(options)
    const result = await h.auth.confirmarCorreoPendiente(undefined, form({ email: 'member@example.test' }))
    assert.ok(result.error)
    assert.equal(result.mensaje, undefined)
    assert.doesNotMatch(result.error, /member@|secret/)
    assert.equal(h.calls.length, 1)
    if (options.error?.status === 429) assert.match(result.error, /minuto|Espere/)
  }
})
