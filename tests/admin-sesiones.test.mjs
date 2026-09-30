import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const authId = 'a1111111-1111-4111-8111-111111111111'
const sessionId = 'b2222222-2222-4222-8222-222222222222'

function dal(options = {}) {
  const calls = { claims: 0, sessions: [], onboarding: 0 }
  const profile = options.profile ?? { id: 7, nombre: 'Admin', rol: 'admin', activo: true, auth_user_id: authId, identificacion: null }
  const user = { id: authId, email: 'account@example.test', app_metadata: { provider: options.facebook ? 'facebook' : 'email' } }
  const lookup = { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) }
  async function rpc(name, parameters) {
    calls.sessions.push({ name, parameters })
    if (options.rpcThrows) throw new Error('Session database unavailable')
    return { data: options.live === undefined ? true : options.live, error: options.rpcError ?? null }
  }
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user } }),
      getClaims: async () => {
        calls.claims += 1
        if (options.claimsThrows) throw new Error('Token verifier unavailable')
        return { data: { claims: { sub: authId, session_id: sessionId, ...options.claims } }, error: options.claimsError ?? null }
      },
    },
    from: () => lookup,
    rpc,
  }
  const admin = options.noAdmin ? null : { from: () => lookup, rpc }
  const mod = { exports: {} }
  const code = ts.transpileModule(readFileSync('lib/dal.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const mocks = {
    'server-only': {},
    react: { cache: fn => fn },
    'next/navigation': { redirect: path => { const error = new Error('Redirect'); error.path = path; throw error } },
    '@/lib/facebook-auth': { cuentaCreadaConFacebook: u => u?.app_metadata?.provider === 'facebook' },
    '@/lib/facebook-alta': {
      altaFacebookLista: async () => { calls.onboarding += 1; return options.onboarding ?? false },
      altaFacebookPendiente: async () => false,
    },
    '@/lib/util': { destinoInterno: value => value },
    '@/lib/supabase/admin': { createAdmin: () => admin },
    '@/lib/supabase/server': { createClient: async () => supabase, sinSupabase: () => false },
  }
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, require: name => mocks[name] ?? require(name), console, Error, URL, Date,
  })
  return { ...mod.exports, calls }
}

test('administrator DAL binds a verified token subject and session to the live server-side session', async () => {
  const h = dal()
  const account = await h.obtenerUsuario()
  assert.equal(account.id, 7)
  assert.equal(h.calls.claims, 1)
  assert.equal(h.calls.sessions.length, 1)
  const call = h.calls.sessions[0]
  assert.equal(call.name, 'sesion_administracion_vigente')
  assert.equal(call.parameters.p_auth_user_id, authId)
  assert.equal(call.parameters.p_session_id, sessionId)
})

test('administrator DAL denies revoked sessions and fails closed for verifier or session-service errors', async () => {
  for (const options of [
    { live: false }, { live: null }, { live: 'true' }, { live: [] },
    { rpcError: { message: 'Unavailable' } }, { rpcThrows: true },
    { claimsError: { message: 'Invalid token' } }, { claimsThrows: true },
  ]) {
    const h = dal(options)
    assert.equal(await h.obtenerUsuario(), null, JSON.stringify(options))
  }
})

test('missing, malformed and mismatched administrator claims never reach privileged session lookup', async () => {
  for (const claims of [
    { session_id: undefined }, { session_id: null }, { session_id: '' }, { session_id: 7 },
    { session_id: 'not-a-uuid' }, { sub: 'someone-else' }, { sub: undefined },
  ]) {
    const h = dal({ claims })
    assert.equal(await h.obtenerUsuario(), null)
    assert.equal(h.calls.sessions.length, 0, JSON.stringify(claims))
  }
})

test('session-only administrator reads use the self-scoped RPC and enforce its boolean result', async () => {
  for (const live of [true, false]) {
    const h = dal({ noAdmin: true, live })
    assert.equal(Boolean(await h.obtenerUsuario()), live)
    assert.equal(h.calls.sessions[0].name, 'mi_sesion_administracion_vigente')
    assert.equal(h.calls.sessions[0].parameters, undefined)
  }
})

test('ordinary accounts also require live sessions after an invitation binds their Auth identity', async () => {
  for (const noAdmin of [false, true]) {
    for (const rol of ['propietario', 'agencia', 'inquilino']) {
      const profile = { id: 8, rol, activo: true }
      const live = dal({ noAdmin, profile })
      assert.equal((await live.obtenerUsuario()).id, 8)
      assert.equal(live.calls.claims, 1)
      assert.equal(live.calls.sessions.length, 1)
      for (const failure of [{ live: false }, { claimsThrows: true }, { rpcThrows: true }, { claims: { session_id: null } }]) {
        const revoked = dal({ noAdmin, profile, ...failure })
        assert.equal(await revoked.obtenerUsuario(), null)
      }
    }
  }
})

test('Facebook administrators bypass owner onboarding but still require a live administrator session', async () => {
  for (const live of [true, false]) {
    const h = dal({ facebook: true, live, onboarding: false })
    assert.equal(Boolean(await h.obtenerUsuario()), live)
    assert.equal(h.calls.onboarding, 0)
    assert.equal(h.calls.sessions.length, 1)
  }
  const ordinary = dal({ facebook: true, profile: { id: 8, rol: 'agencia', activo: true }, onboarding: false })
  assert.equal(await ordinary.obtenerUsuario(), null)
  assert.equal(ordinary.calls.onboarding, 1)
})

test('an inactive administrator still cannot pass the role gate', async () => {
  const h = dal({ profile: { id: 7, rol: 'admin', activo: false } })
  await assert.rejects(h.requerirRol('admin'), error => error.path === '/')
})

test('inactive account notices remain available only to the current live session', async () => {
  for (const rol of ['admin', 'propietario']) {
    const profile = { id: 7, rol, activo: false }
    assert.equal((await dal({ profile }).obtenerUsuario()).activo, false)
    assert.equal(await dal({ profile, live: false }).obtenerUsuario(), null)
  }
})
