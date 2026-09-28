import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import test from 'node:test'
const require = createRequire(import.meta.url)
const ts = require('typescript')
class AvisoAdmin extends Error {}
function load(file, mocks) {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: mod, exports: mod.exports, require: (name) => mocks[name] ?? require(name), console, Error, URL, Date })
  return mod.exports
}
const id = 'b2222222-2222-4222-8222-222222222222'
const input = { id, token: 'private-token', clave: 'Password123', confirmacion: 'Password123' }
function harness(config = {}) {
  const calls = [], email = 'invitee@example.com', authId = 'auth-user'
  const invitation = { auth_user_id: authId, email, tipo: 'invite', aceptada_en: null, vence_en: new Date(Date.now() + 60_000).toISOString(), ...config.invitation }
  const user = { id: authId, email, email_confirmed_at: '2026-01-01', ...config.user }
  const db = {
    from: (table) => {
      const filters = {}
      const q = {
        select: () => q,
        eq: (k, v) => { filters[k] = v; return q },
        ilike: (k, v) => { filters[k] = v; return q },
        maybeSingle: async () => {
          calls.push(['read', table, filters])
          return { data: table === 'usuarios' ? config.existing ?? null : ('id' in filters ? (config.missing ? null : invitation) : config.pending ?? null), error: null }
        },
        upsert: async (v) => { calls.push(['upsert', v]); return { error: config.saveError } },
      }
      return q
    },
    rpc: async (name, params) => { calls.push(['rpc', name, params]); return { error: config.rpcError } },
    auth: { admin: {
      getUserById: async () => ({ data: { user }, error: null }),
      generateLink: async (p) => { calls.push(['link', p]); return { data: { user, properties: { hashed_token: input.token } }, error: config.linkError } },
    } },
  }
  const api = load('lib/invitaciones-admin.ts', {
    'server-only': {},
    '@/lib/admin': { AvisoAdmin, SinClaveAdmin: AvisoAdmin },
    '@/lib/dal': { requerirRol: async (role) => { calls.push(['authorize', role]); if (config.unauthorized) throw new Error('unauthorized'); return { id: 7 } } },
    '@/lib/supabase/admin': { createAdmin: () => db },
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      verifyOtp: async (p) => { calls.push(['verify', p]); return { data: { user }, error: config.tokenError } },
      updateUser: async (p) => { calls.push(['password', p]); return { error: config.passwordError } },
      signOut: async (p) => { calls.push(['signOut', p]); return { error: config.signOutError } },
    } }) },
    '@/lib/correo-resenas': {
      correoResenasConfigurado: () => config.configured !== false,
      enviarCorreo: async (p) => { calls.push(['send', p]); return config.sent !== false },
    },
  })
  return { ...api, calls }
}
const invite = { nombre: 'Invited Admin', email: 'invitee@example.com', enviarPorCorreo: true }

test('only active admins can invite and unconfigured email creates no Auth account', async () => {
  for (const config of [{ unauthorized: true }, { configured: false }]) {
    const h = harness(config)
    await assert.rejects(h.invitarAdmin(invite))
    assert.equal(h.calls.length, 1)
    assert.equal(h.calls[0][0], 'authorize')
  }
})
test('existing accounts are never promoted, reactivated or emailed by invitations', async () => {
  const h = harness({ existing: { id: 20 } })
  await assert.rejects(h.invitarAdmin(invite), /ya tiene cuenta/)
  assert.ok(h.calls.every(([op]) => !['link', 'upsert', 'send', 'rpc'].includes(op)))
})
test('invitations persist a digest and session actor before sending, without granting admin access', async () => {
  const h = harness()
  await h.invitarAdmin(invite)
  const row = h.calls.find(([op]) => op === 'upsert')[1]
  assert.equal(row.invitado_por, 7)
  assert.equal(row.token_digest, createHash('sha256').update(input.token).digest('hex'))
  assert.equal(row.auth_user_id, 'auth-user')
  const mail = h.calls.find(([op]) => op === 'send')[1]
  assert.equal(mail.to, invite.email)
  assert.match(mail.text, /https:\/\/www.protectoradelalquiler.com\/invitacion\/admin\?/)
  assert.equal(h.calls.some(([op]) => op === 'rpc'), false)
})
test('save and delivery failures are never reported as success or grant privileges', async () => {
  for (const config of [{ saveError: {} }, { linkError: {} }]) {
    const h = harness(config)
    await assert.rejects(h.invitarAdmin(invite))
    assert.equal(h.calls.some(([op]) => op === 'rpc'), false)
    if (config.saveError || config.linkError) assert.equal(h.calls.some(([op]) => op === 'send'), false)
  }
})
test('confirmed pending invite can be renewed with a recovery link bound to the same Auth identity', async () => {
  const h = harness({ pending: { auth_user_id: 'auth-user' } })
  await h.invitarAdmin(invite)
  assert.equal(h.calls.find(([op]) => op === 'link')[1].type, 'recovery')
  const changed = harness({ pending: { auth_user_id: 'different-user' } })
  await assert.rejects(changed.invitarAdmin(invite), /cuenta cambió/)
  assert.equal(changed.calls.some(([op]) => op === 'send'), false)
})
test('invalid, expired, accepted and unknown invitations cannot consume a token or grant access', async () => {
  for (const config of [{ missing: true }, { invitation: { aceptada_en: '2026-01-01' } }, { invitation: { vence_en: '2020-01-01' } }]) {
    const h = harness(config)
    await assert.rejects(h.aceptarInvitacionAdmin(input))
    assert.ok(h.calls.every(([op]) => op === 'read'))
  }
  const h = harness()
  await assert.rejects(h.aceptarInvitacionAdmin({ ...input, confirmacion: 'different' }))
  assert.equal(h.calls.length, 0)
})
test('only verified matching email and Auth id can reach password and role activation', async () => {
  for (const config of [{ tokenError: {} }, { user: { id: 'other' } }, { user: { email: 'other@example.com' } }, { user: { email_confirmed_at: null } }]) {
    const h = harness(config)
    await assert.rejects(h.aceptarInvitacionAdmin(input))
    assert.equal(h.calls.some(([op]) => ['rpc', 'password'].includes(op)), false)
  }
})
test('role activation happens after setting password and revoking older sessions, with verified id', async () => {
  const h = harness()
  await h.aceptarInvitacionAdmin(input)
  assert.deepEqual(h.calls.map(([op]) => op), ['read', 'verify', 'password', 'signOut', 'rpc'])
  assert.equal(h.calls[0][2].token_digest, createHash('sha256').update(input.token).digest('hex'))
  assert.equal(h.calls[3][1].scope, 'others')
  assert.equal(h.calls[4][2].p_auth_user_id, 'auth-user')
  for (const config of [{ passwordError: {} }, { signOutError: {} }]) {
    const failed = harness(config)
    await assert.rejects(failed.aceptarInvitacionAdmin(input))
    assert.equal(failed.calls.some(([op]) => op === 'rpc'), false)
  }
})

function dal({ rol = 'propietario', activo = true, reviews = 0, error = null } = {}) {
  const calls = []
  const db = { from: (table) => {
    calls.push(table)
    const q = { select: () => q, eq: (k, v) => { if (k === 'estado') calls.push(v); return q },
      maybeSingle: async () => ({ data: { id: 3, rol, activo }, error }),
      then: (resolve) => resolve({ count: reviews, error }),
    }
    return q
  } }
  const api = load('lib/dal.ts', {
    'server-only': {}, react: { cache: (fn) => fn }, 'next/navigation': {},
    '@/lib/facebook-alta': {}, '@/lib/facebook-auth': {}, '@/lib/util': {},
    '@/lib/supabase/admin': { createAdmin: () => db },
    '@/lib/supabase/server': { createClient: async () => db, sinSupabase: () => false },
  })
  return { ...api, calls, usuario: { id: 3, rol, activo } }
}
test('unapproved users and inactive accounts cannot consult; active admins need no review', async () => {
  for (const config of [{}, { reviews: 0 }, { error: {} }, { reviews: 1, activo: false }, { rol: 'admin', activo: false }]) {
    const d = dal(config)
    assert.equal(await d.puedeConsultar(d.usuario), false)
  }
  const approved = dal({ reviews: 1 })
  assert.equal(await approved.puedeConsultar(approved.usuario), true)
  assert.ok(approved.calls.includes('publicada'))
  const admin = dal({ rol: 'admin' })
  assert.equal(await admin.puedeConsultar(admin.usuario), true)
  assert.equal(admin.calls.length, 0)
})
test('login resumes missing first review but exempts admins and does not repeat pending submissions', async () => {
  assert.equal(await dal().destinoTrasLogin('auth-user', '/fichas'), '/registro/resena')
  assert.equal(await dal({ reviews: 1 }).destinoTrasLogin('auth-user', '/perfil'), '/perfil')
  assert.equal(await dal({ rol: 'admin' }).destinoTrasLogin('auth-user', '/registro/resena'), '/admin')
  assert.equal(await dal({ rol: 'admin' }).destinoTrasLogin('auth-user', '/fichas'), '/fichas')
})

test('public registration rejects a forged admin role before touching Auth or the database', async () => {
  let writes = 0
  const api = load('lib/actions/auth.ts', {
    'next/headers': {}, 'next/navigation': {}, '@/lib/dal': {},
    '@/lib/correo-recordado': {}, '@/lib/facebook-auth': {}, '@/lib/util': {},
    '@/lib/supabase/server': { sinSupabase: () => false },
    '@/lib/supabase/admin': { createAdmin: () => { writes++; throw new Error('unexpected write') } },
  })
  const form = new FormData()
  for (const [key, value] of Object.entries({ nombre: 'Forged Admin', email: 'fake@example.test', cedula: '102340567', facebook: 'https://www.facebook.com/example', clave: 'Password123', rol: 'admin' })) form.set(key, value)
  assert.ok((await api.registrarse(undefined, form)).error)
  assert.equal(writes, 0)
})

test('manual invitations work with no email provider and never attempt to send', async () => {
  const h = harness({ configured: false })
  const result = await h.invitarAdmin({ ...invite, enviarPorCorreo: false })
  assert.equal(result.enviada, false)
  assert.equal(result.email, invite.email)
  assert.equal(new URL(result.enlace).searchParams.get('token'), input.token)
  assert.equal(h.calls.some(([op]) => ['send', 'rpc'].includes(op)), false)
})
test('email failure leaves a usable manual link with an explicit warning', async () => {
  const h = harness({ sent: false })
  const result = await h.invitarAdmin(invite)
  assert.equal(result.enviada, false)
  assert.match(result.advertencia, /copiar el enlace/)
  assert.ok(result.enlace)
  assert.equal(h.calls.some(([op]) => op === 'rpc'), false)
})
