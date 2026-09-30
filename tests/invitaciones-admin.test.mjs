import { runtimeMocks } from './helpers/runtime-mocks.mjs'
import { mocksCedula } from './helpers/cedula-mocks.mjs'
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
  }).outputText, { module: mod, exports: mod.exports, require: (name) => mocks[name] ?? mocksCedula[name] ?? (runtimeMocks[name] ?? require(name)), console, Error, URL, Date })
  return mod.exports
}
const id = 'b2222222-2222-4222-8222-222222222222'
const sessionId = 'd4444444-4444-4444-8444-444444444444'
const input = { id, token: 'private-token', clave: 'Password123', confirmacion: 'Password123' }
const existing = { id: 20, nombre: 'Existing', email: 'invitee@example.com', rol: 'propietario', activo: true, auth_user_id: 'auth-user', actualizado_en: '2026-01-01T00:00:00.123456Z' }
function harness(config = {}) {
  const calls = [], email = config.email ?? 'invitee@example.com', authId = 'auth-user'
  const clientOptions = []
  let leaseId = null
  const invitation = { auth_user_id: authId, email, nombre: 'Invited', proposito: 'administracion', tipo: 'invite', aceptada_en: null, revocada_en: null, vence_en: new Date(Date.now() + 60_000).toISOString(), ...config.invitation }
  const user = { id: authId, email, email_confirmed_at: '2026-01-01', ...config.user }
  const db = {
    from: (table) => {
      const filters = {}
      let from = 0, to = Infinity, fields, update
      const q = {
        select: (v) => { fields = v; return q },
        eq: (k, v) => { filters[k] = v; return q },
        order: () => q, limit: () => q,
        range: (a, b) => { from = a; to = b; return q },
        update: (value) => { update = value; return q },
        maybeSingle: async () => {
          calls.push(['read', table, filters])
          return { data: 'id' in filters ? (config.missing ? null : invitation) : config.pending ?? null, error: config.readError }
        },
        then: (resolve) => {
          calls.push(update ? ['delivery', update, filters] : ['list', fields, from, to])
          resolve({ data: (config.rows ?? []).slice(from, to + 1), error: config.deliveryError })
        },
      }
      return q
    },
    rpc: (name, params) => {
      calls.push(['rpc', name, params])
      if (name === 'cuenta_para_invitacion_admin') return { maybeSingle: async () => ({ data: config.existing ?? null, error: config.lookupError }) }
      if (name === 'reservar_emision_invitacion_admin') {
        if (config.reserveError || (config.simulateLease && leaseId)) return Promise.resolve({ error: config.reserveError ?? { code: 'P0001', message: 'Ya se está generando una invitación' } })
        leaseId = params.p_id
      }
      if (name === 'liberar_emision_invitacion_admin' && leaseId === params.p_id) leaseId = null
      return Promise.resolve({ error: name === 'registrar_invitacion_admin' ? config.saveError : config.rpcError })
    },
    auth: { admin: {
      getUserById: async () => ({ data: { user }, error: config.identityError }),
      generateLink: async (p) => {
        calls.push(['link', p])
        config.onLink?.()
        if (config.linkGate) await config.linkGate
        return { data: { user, properties: { hashed_token: input.token } }, error: config.inviteExists && p.type === 'invite' ? { code: 'email_exists' } : config.linkError }
      },
      signOut: async (token, scope) => { calls.push(['signOut', token, scope]); return { error: config.signOutError } },
    } },
  }
  const api = load('lib/invitaciones-admin.ts', {
    'server-only': {},
    '@/lib/admin': { AvisoAdmin, SinClaveAdmin: AvisoAdmin },
    '@/lib/dal': { requerirRol: async (role) => { calls.push(['authorize', role]); if (config.unauthorized) throw new Error('unauthorized'); return { id: 7 } } },
    '@/lib/supabase/admin': { createAdmin: options => { clientOptions.push(options); return db } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      verifyOtp: async (p) => { calls.push(['verify', p]); return { data: { user, session: config.noSession ? null : { access_token: 'verified-access-token' } }, error: config.tokenError } },
      updateUser: async (p) => { calls.push(['password', p]); return { error: config.passwordError } },
      getClaims: async () => { calls.push(['claims']); return { data: { claims: { sub: user.id, session_id: sessionId, ...config.claims } }, error: config.claimsError } },
    } }) },
    '@/lib/correo-resenas': {
      correoResenasConfigurado: () => config.configured !== false,
      enviarCorreo: async (p) => { calls.push(['send', p]); return config.sent !== false },
    },
  })
  return { ...api, calls, clientOptions }
}
const invite = { nombre: 'Invited Admin', email: 'invitee@example.com', enviarPorCorreo: true }
const registration = h => h.calls.find(([op, name]) => op === 'rpc' && name === 'registrar_invitacion_admin')?.[2]
const activated = h => h.calls.some(([op, name]) => op === 'rpc' && name === 'aceptar_invitacion_admin')

test('only active admins can invite and unavailable requested email creates no Auth account', async () => {
  for (const config of [{ unauthorized: true }, { configured: false }]) {
    const h = harness(config)
    await assert.rejects(h.invitarAdmin(invite))
    assert.equal(h.calls.length, 1)
    assert.equal(h.calls[0][0], 'authorize')
  }
})
test('suspended accounts, existing administrators and historical emails cannot receive a privilege invitation', async () => {
  for (const account of [{ ...existing, activo: false }, { ...existing, rol: 'admin' }]) {
    const h = harness({ existing: account })
    await assert.rejects(h.invitarAdmin(invite))
    assert.ok(h.calls.every(([op]) => !['link', 'send'].includes(op)))
    assert.equal(registration(h), undefined)
  }
  await assert.rejects(harness().invitarAdmin({ ...invite, email: 'autor-1@legacy.laprotec' }))
})
test('existing-user elevation records the exact expected profile version and requires a recovery invitation', async () => {
  const h = harness({ existing })
  await h.invitarAdmin(invite)
  assert.equal(h.calls.find(([op]) => op === 'link')[1].type, 'recovery')
  assert.equal(registration(h).p_target_usuario_id, existing.id)
  assert.equal(registration(h).p_target_version, existing.actualizado_en)
  assert.equal(registration(h).p_proposito, 'administracion')
  assert.equal(activated(h), false)
})
test('login provisioning only targets an existing active profile without Auth and explicitly preserves its purpose', async () => {
  const h = harness({ existing: { ...existing, auth_user_id: null, rol: 'inquilino' } })
  const result = await h.invitarAdmin({ ...invite, proposito: 'acceso' })
  assert.equal(result.proposito, 'acceso')
  assert.equal(registration(h).p_target_usuario_id, existing.id)
  assert.equal(registration(h).p_proposito, 'acceso')
  for (const config of [{}, { existing }, { existing: { ...existing, activo: false, auth_user_id: null } }]) {
    const denied = harness(config)
    await assert.rejects(denied.invitarAdmin({ ...invite, proposito: 'acceso' }))
    assert.equal(registration(denied), undefined)
  }
})
test('invitation lookup passes literal normalized email to equality RPC, never LIKE patterns', async () => {
  const email = 'ana_maria@example.com'
  const h = harness({ email })
  await h.invitarAdmin({ ...invite, email: email.toUpperCase(), enviarPorCorreo: false })
  assert.equal(h.calls.find(([op, name]) => op === 'rpc' && name === 'cuenta_para_invitacion_admin')[2].p_email, email)
})
test('invitations persist only a digest and session actor before sending without granting permissions', async () => {
  const h = harness()
  const result = await h.invitarAdmin(invite)
  const row = registration(h)
  assert.equal(row.p_admin_id, 7)
  assert.equal(row.p_digest, createHash('sha256').update(input.token).digest('hex'))
  assert.equal(row.p_auth_user_id, 'auth-user')
  assert.equal(row.p_target_usuario_id, null)
  assert.equal(result.venceEn, row.p_vence_en)
  const mail = h.calls.find(([op]) => op === 'send')[1]
  assert.equal(mail.to, invite.email)
  assert.match(mail.text, /https:\/\/www.protectoradelalquiler.com\/invitacion\/admin\?/)
  assert.equal(activated(h), false)
  assert.ok(h.calls.find(([op]) => op === 'delivery')[1].enviada_en)
})
test('save or link failures are never reported as successful delivery or grant privileges', async () => {
  for (const config of [{ saveError: {} }, { linkError: {} }]) {
    const h = harness(config)
    await assert.rejects(h.invitarAdmin(invite))
    assert.equal(activated(h), false)
    assert.equal(h.calls.some(([op]) => op === 'send'), false)
    assert.equal(h.calls.at(-1)[1], 'liberar_emision_invitacion_admin')
  }
})
test('only one concurrent request can generate an Auth token for the same mailbox', async () => {
  let release, generated
  const linkGate = new Promise(resolve => { release = resolve })
  const started = new Promise(resolve => { generated = resolve })
  const h = harness({ simulateLease: true, linkGate, onLink: generated })
  const first = h.invitarAdmin({ ...invite, enviarPorCorreo: false })
  await started
  await assert.rejects(h.invitarAdmin(invite), /se está generando/)
  assert.equal(h.calls.filter(([op]) => op === 'link').length, 1)
  release()
  await first
  const lease = h.calls.find(([op, name]) => op === 'rpc' && name === 'reservar_emision_invitacion_admin')[2]
  assert.equal(registration(h).p_id, lease.p_id)
  assert.equal(h.calls.at(-1)[2].p_id, lease.p_id)
  assert.equal(h.clientOptions[0].requestTimeoutMs, 20_000)
})
test('confirmed pending invitation renews with recovery bound to the same Auth identity', async () => {
  const h = harness({ pending: { auth_user_id: 'auth-user' } })
  await h.invitarAdmin(invite)
  assert.equal(h.calls.find(([op]) => op === 'link')[1].type, 'recovery')
  const changed = harness({ pending: { auth_user_id: 'different-user' } })
  await assert.rejects(changed.invitarAdmin(invite), /cambió/)
  assert.equal(changed.calls.some(([op]) => op === 'send'), false)
})
test('an orphaned confirmed Auth identity recovers without replacing the profile or granting access early', async () => {
  const h = harness({ existing: { ...existing, auth_user_id: null }, inviteExists: true })
  await h.invitarAdmin(invite)
  assert.deepEqual(h.calls.filter(([op]) => op === 'link').map(([, p]) => p.type), ['invite', 'recovery'])
  assert.equal(registration(h).p_target_usuario_id, existing.id)
  assert.equal(activated(h), false)
})
test('invalid, expired, revoked, accepted and unknown invitations cannot consume a token', async () => {
  for (const config of [{ missing: true }, { invitation: { aceptada_en: '2026-01-01' } }, { invitation: { revocada_en: '2026-01-01' } }, { invitation: { vence_en: '2020-01-01' } }]) {
    const h = harness(config)
    await assert.rejects(h.aceptarInvitacionAdmin(input))
    assert.ok(h.calls.every(([op]) => op === 'read'))
  }
  const h = harness()
  await assert.rejects(h.aceptarInvitacionAdmin({ ...input, confirmacion: 'different' }))
  assert.equal(h.calls.length, 0)
})
test('only a verified matching mailbox and Auth id with a session can change a password', async () => {
  for (const config of [{ tokenError: {} }, { noSession: true }, { user: { id: 'other' } }, { user: { email: 'other@example.com' } }, { user: { email_confirmed_at: null } }]) {
    const h = harness(config)
    await assert.rejects(h.aceptarInvitacionAdmin(input))
    assert.equal(h.calls.some(([op]) => ['rpc', 'password'].includes(op)), false)
  }
})
test('activation follows password change, verified session claims and strict revocation of all other sessions', async () => {
  const h = harness()
  await h.aceptarInvitacionAdmin(input)
  assert.deepEqual(h.calls.map(([op]) => op), ['read', 'verify', 'password', 'claims', 'signOut', 'rpc'])
  assert.equal(h.calls[0][2].token_digest, createHash('sha256').update(input.token).digest('hex'))
  assert.deepEqual(h.calls[4], ['signOut', 'verified-access-token', 'others'])
  assert.equal(h.calls[5][2].p_auth_user_id, 'auth-user')
  assert.equal(h.calls[5][2].p_session_id, sessionId)
  for (const config of [{ passwordError: {} }, { signOutError: {} }, { claimsError: {} }, { claims: { sub: 'other' } }, { claims: { session_id: null } }, { claims: { session_id: 'not-a-uuid' } }]) {
    const failed = harness(config)
    await assert.rejects(failed.aceptarInvitacionAdmin(input))
    assert.equal(activated(failed), false)
  }
})
test('invitation preview consumes no OTP and cancellation sends the authenticated actor to its RPC', async () => {
  const h = harness()
  const preview = await h.consultarInvitacionAdmin(id, input.token)
  assert.equal(preview.email, invite.email)
  assert.equal('auth_user_id' in preview, false)
  assert.ok(h.calls.every(([op]) => op === 'read'))
  await h.cancelarInvitacionAdmin(id)
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.at(-1))), ['rpc', 'cancelar_invitacion_admin', { p_admin_id: 7, p_id: id }])
  await assert.rejects(harness({ unauthorized: true }).cancelarInvitacionAdmin(id))
})
test('listing distinguishes four states and excludes link tokens and Auth identities from selected fields', async () => {
  const future = new Date(Date.now() + 60_000).toISOString()
  const rows = [
    { id: 'pending', vence_en: future, invitador: { nombre: 'Admin' } },
    { id: 'expired', vence_en: '2020-01-01', invitador: null },
    { id: 'revoked', vence_en: future, revocada_en: '2026-01-01', invitador: [] },
    { id: 'accepted', vence_en: future, aceptada_en: '2026-01-01', invitador: [{ nombre: 'Admin' }] },
  ]
  const h = harness({ rows })
  const result = await h.listarInvitacionesAdmin()
  assert.deepEqual(Array.from(result, r => r.estado), ['pendiente', 'vencida', 'revocada', 'aceptada'])
  assert.equal(result[0].invitador_nombre, 'Admin')
  assert.equal(result[1].invitador_nombre, null)
  const selection = h.calls.find(([op]) => op === 'list')[1]
  assert.doesNotMatch(selection, /auth_user_id|token_digest/)
  const large = harness({ rows: Array.from({ length: 501 }, (_, i) => ({ ...rows[0], id: String(i) })) })
  assert.equal((await large.listarInvitacionesAdmin()).length, 501)
  assert.equal(large.calls.filter(([op]) => op === 'list').length, 2)
})

function dal({ rol = 'propietario', activo = true, reviews = 0, error = null, expired = false, service = true, thrown = false, missing = false } = {}) {
  const calls = []
  const db = { from: (table) => {
    calls.push(table)
    const q = { select: () => q, eq: (k, v) => { if (k === 'estado') calls.push(v); return q },
      maybeSingle: async () => ({ data: { id: 3, rol, activo }, error }),
      then: (resolve) => resolve({ count: reviews, error }),
    }
    return q
  }, auth: { getUser: async () => ({ data: { user: { id: 'auth-user' } } }) }, rpc: async (name, params) => {
    calls.push([name, params])
    if (thrown) throw new Error('Database unavailable')
    return { error, data: missing ? [] : [{
      usuario_id: 3, puede_consultar: activo && (rol === 'admin' || (reviews > 0 && !expired)),
      aprobadas: reviews, pendientes: 0, rechazadas: 0,
      ultima_aprobacion_en: null, vence_en: null,
      motivo: expired ? 'vencida' : reviews ? 'vigente' : 'ninguna',
    }] }
  } }
  const api = load('lib/dal.ts', {
    'server-only': {}, react: { cache: (fn) => fn }, 'next/navigation': {},
    '@/lib/facebook-alta': {}, '@/lib/facebook-auth': { cuentaCreadaConFacebook: () => false }, '@/lib/util': {},
    '@/lib/supabase/admin': { createAdmin: () => service ? db : null },
    '@/lib/supabase/server': { createClient: async () => db, sinSupabase: () => false },
  })
  return { ...api, calls, usuario: { id: 3, rol, activo } }
}
test('unapproved users and inactive accounts cannot consult; active admins need no review', async () => {
  for (const config of [{}, { reviews: 0 }, { error: {} }, { thrown: true }, { missing: true }, { reviews: 1, expired: true }, { reviews: 4, expired: true }, { reviews: 1, activo: false }, { rol: 'admin', activo: false }]) {
    const d = dal(config)
    assert.equal(await d.puedeConsultar(d.usuario), false)
  }
  const approved = dal({ reviews: 1 })
  assert.equal(await approved.puedeConsultar(approved.usuario), true)
  assert.equal(approved.calls[0][0], 'accesos_consulta')
  assert.equal(approved.calls[0][1].p_usuario_ids[0], approved.usuario.id)
  const admin = dal({ rol: 'admin' })
  assert.equal(await admin.puedeConsultar(admin.usuario), true)
  assert.equal(admin.calls[0][0], 'accesos_consulta')
})
test('session-only access uses the self-scoped RPC and errors stay distinct from missing reviews', async () => {
  const session = dal({ service: false, reviews: 2 })
  assert.equal(await session.puedeConsultar(session.usuario), true)
  assert.equal(session.calls[0][0], 'mi_acceso_consulta')
  assert.equal(session.calls[0][1], undefined)
  const failure = dal({ error: {} })
  assert.equal((await failure.accesoConsulta(failure.usuario)).motivo, 'error')
})
test('expired access blocks all registry reads before the service client reads tenant data', async () => {
  for (const config of [{ reviews: 4, expired: true }, { reviews: 0 }, { error: {} }]) {
    const d = dal(config)
    assert.equal((await d.buscarFichas({ q: 'Ana' })).total, 0)
    assert.equal(await d.obtenerFicha(1), null)
    assert.equal(await d.resumenRegistro(), null)
    assert.equal((await d.buscarPersonasParaResena('Ana')).length, 0)
    assert.equal(d.calls.includes('personas'), false)
    assert.equal(d.calls.includes('resenas'), false)
  }
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
  assert.equal(h.calls.some(([op]) => op === 'send'), false)
  assert.equal(activated(h), false)
})
test('email failure leaves a usable manual link with an explicit warning', async () => {
  const h = harness({ sent: false })
  const result = await h.invitarAdmin(invite)
  assert.equal(result.enviada, false)
  assert.match(result.advertencia, /copiar el enlace/)
  assert.ok(result.enlace)
  assert.equal(activated(h), false)
  assert.ok(h.calls.find(([op]) => op === 'delivery')[1].error_envio_en)
})

test('invitation server actions enforce explicit confirmation and preserve expiry and purpose in results', async () => {
  const calls = []
  const api = load('lib/actions/invitaciones.ts', {
    'next/navigation': { unstable_rethrow: () => {} },
    'next/cache': { revalidatePath: path => calls.push(['revalidate', path]) },
    '@/lib/admin': { AvisoAdmin },
    '@/lib/invitaciones-admin': {
      invitarAdmin: async data => {
        calls.push(['invite', data])
        return { enlace: 'https://www.protectoradelalquiler.com/invitacion/admin', email: data.email, enviada: false, venceEn: '2026-01-02T00:00:00Z', proposito: data.proposito }
      },
      cancelarInvitacionAdmin: async value => calls.push(['cancel', value]),
    },
  })
  const form = new FormData()
  form.set('nombre', 'Existing Owner')
  form.set('email', ' OWNER@example.com ')
  form.set('proposito', 'acceso')
  assert.ok((await api.invitarAdminAction(undefined, form)).error)
  assert.ok((await api.cancelarInvitacionAdminAction(id, undefined, form)).error)
  assert.equal(calls.length, 0)
  form.set('confirmar', '1')
  const result = await api.invitarAdminAction(undefined, form)
  assert.equal(result.invitacion.email, 'owner@example.com')
  assert.equal(result.invitacion.proposito, 'acceso')
  assert.equal(result.invitacion.venceEn, '2026-01-02T00:00:00Z')
  assert.ok(calls.some(([op, path]) => op === 'revalidate' && path === '/admin/usuarios'))
  await api.cancelarInvitacionAdminAction(id, undefined, form)
  assert.ok(calls.some(([op, value]) => op === 'cancel' && value === id))
  form.set('proposito', 'superadmin')
  const count = calls.length
  assert.ok((await api.invitarAdminAction(undefined, form)).error)
  assert.equal(calls.length, count)
})

test('acceptance redirects login provisioning to the profile and administration to its workspace', async () => {
  for (const [proposito, expected] of [['acceso', '/perfil'], ['administracion', '/admin']]) {
    const api = load('lib/actions/invitaciones.ts', {
      'next/navigation': { unstable_rethrow: () => {}, redirect: href => { throw Object.assign(new Error('redirect'), { href }) } },
      'next/cache': { revalidatePath: () => {} }, '@/lib/admin': { AvisoAdmin },
      '@/lib/invitaciones-admin': { aceptarInvitacionAdmin: async () => ({ proposito }) },
    })
    await assert.rejects(api.aceptarInvitacionAction(id, input.token, undefined, new FormData()), error => error.href === expected)
  }
})
