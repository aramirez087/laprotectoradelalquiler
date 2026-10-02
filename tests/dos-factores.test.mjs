import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cargarTS } from './helpers/cedula-mocks.mjs'
import { requiereSegundoFactor, destinoSegundoFactor, rutaSegundoFactor } from '../lib/dos-factores.ts'

const id = 'a1111111-1111-4111-8111-111111111111'
const otroId = 'b2222222-2222-4222-8222-222222222222'
const factor = (status = 'verified', factorId = id) => ({ id: factorId, factor_type: 'totp', status })
function datos(factorId = id, codigo = '012345', siguiente = '/perfil') {
  const form = new FormData()
  form.set('factorId', factorId); form.set('codigo', codigo); form.set('siguiente', siguiente)
  return form
}
function harness({ factors = [factor()], verifyError = null, userError = null, denied = false, refreshError = null, unenrollError = null } = {}) {
  const calls = []
  const user = { id: 'user', factors }
  const supabase = { auth: {
    getUser: async () => ({ data: { user: userError ? null : user }, error: userError }),
    refreshSession: async () => { calls.push(['refresh']); return { error: refreshError } },
    signOut: async () => { calls.push(['signOut']); return { error: null } },
    mfa: {
      listFactors: async () => ({ data: { all: factors, totp: factors.filter(f => f.status === 'verified') }, error: null }),
      enroll: async args => { calls.push(['enroll', args]); return { data: { id, totp: { qr_code: '<svg/>', secret: 'test-secret' } }, error: null } },
      unenroll: async args => { calls.push(['unenroll', args.factorId]); return { error: unenrollError } },
      challengeAndVerify: async args => { calls.push(['verify', args]); return { data: {}, error: verifyError } },
    },
  } }
  const actions = cargarTS('lib/actions/dos-factores.ts', {
    'next/cache': { revalidatePath: (...args) => calls.push(['revalidate', ...args]) },
    'next/navigation': {
      redirect: path => { const error = new Error('Redirect'); error.path = path; throw error },
      unstable_rethrow: error => { if (error?.path) throw error },
    },
    '@/lib/dal': {
      requireUsuario: async () => { if (denied) throw new Error('Denied'); return { id: 7 } },
      destinoTrasLogin: async (_id, siguiente) => { calls.push(['destination', siguiente]); return siguiente },
    },
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/supabase/admin': { createAdmin: () => null },
  }, { FormData })
  return { actions, calls }
}

test('2FA remains optional and an unfinished enrollment never requires a second factor', async () => {
  for (const factors of [undefined, [], [factor('unverified')]]) {
    assert.equal(await requiereSegundoFactor({ auth: { getClaims: () => { throw new Error('Unnecessary check') } } }, { factors }), false)
  }
})

test('verified live factors require signed AAL2 claims, regardless of user metadata or sign-in provider', async () => {
  for (const provider of ['email', 'facebook']) {
    for (const aal of ['aal1', 'aal2', undefined]) {
      const user = { id: 'user', factors: [factor()], app_metadata: { provider }, user_metadata: { aal: 'aal2', two_factor: false } }
      const db = { auth: { getClaims: async () => ({ data: { claims: { sub: 'user', aal } }, error: null }) } }
      assert.equal(await requiereSegundoFactor(db, user), aal !== 'aal2')
    }
  }
})

test('invalid, absent, mismatched and unavailable claims fail closed for enrolled accounts', async () => {
  for (const result of [{ data: null, error: null }, { data: { claims: { sub: 'other', aal: 'aal2' } }, error: null }, { error: new Error('Offline') }]) {
    await assert.rejects(requiereSegundoFactor({ auth: { getClaims: async () => result } }, { id: 'user', factors: [factor()] }))
  }
})

test('challenge destinations reject external links and recursive login routes', () => {
  for (const path of ['https://evil.test', '//evil.test', '/login/verificar?siguiente=/login/verificar', '/login', '/login?x=1']) assert.equal(destinoSegundoFactor(path), '/')
  assert.equal(destinoSegundoFactor('/fichas?q=Ana&pagina=2'), '/fichas?q=Ana&pagina=2')
  assert.equal(new URL(rutaSegundoFactor('/perfil'), 'https://example.test').searchParams.get('siguiente'), '/perfil')
})

test('setup uses the real TOTP enrollment and only removes abandoned, unverified factors', async () => {
  const h = harness({ factors: [factor('unverified', otroId)] })
  const result = await h.actions.iniciarConfiguracionDosFactores()
  assert.equal(result.configuracion.factorId, id)
  assert.equal(result.configuracion.secreto, 'test-secret')
  assert.deepEqual(h.calls.map(c => c[0]), ['unenroll', 'enroll'])
  const active = harness()
  assert.ok((await active.actions.iniciarConfiguracionDosFactores()).error)
  assert.equal(active.calls.length, 0)
})

test('setup and removal reject unauthenticated or partial sessions before any factor mutation', async () => {
  for (const name of ['iniciarConfiguracionDosFactores', 'confirmarConfiguracionDosFactores', 'cancelarConfiguracionDosFactores', 'desactivarDosFactores']) {
    const h = harness({ denied: true })
    await assert.rejects(h.actions[name](datos()), /Denied/)
    assert.equal(h.calls.length, 0)
  }
})

test('activation validates the first code and keeps setup retryable on bad codes', async () => {
  const bad = harness({ factors: [factor('unverified')], verifyError: { status: 400 } })
  assert.match((await bad.actions.confirmarConfiguracionDosFactores(datos())).error, /código no es válido/)
  assert.equal(bad.calls.some(c => c[0] === 'revalidate'), false)
  const good = harness({ factors: [factor('unverified')] })
  await assert.rejects(good.actions.confirmarConfiguracionDosFactores(datos()), e => e.path === '/perfil?dos_factores=activada#seguridad')
  assert.equal(good.calls[0][1].code, '012345')
})

test('cancellation can remove only an owned unverified factor and never turns off active protection', async () => {
  for (const factors of [[factor()], [], [factor('unverified', otroId)]]) {
    const h = harness({ factors })
    assert.ok((await h.actions.cancelarConfiguracionDosFactores(datos())).error)
    assert.equal(h.calls.length, 0)
  }
  const h = harness({ factors: [factor('unverified')] })
  assert.equal((await h.actions.cancelarConfiguracionDosFactores(datos())).error, undefined)
  assert.equal(h.calls[0][0], 'unenroll')
})

test('MFA challenge rejects malformed codes, unverified factors, other accounts and expired sessions', async () => {
  for (const [options, form] of [
    [{}, datos(id, '123')], [{}, datos(id, 'abcdef')], [{}, datos('forged')],
    [{}, datos(otroId)], [{ factors: [factor('unverified')] }, datos()], [{ userError: new Error('Expired') }, datos()],
  ]) {
    const h = harness(options)
    assert.ok((await h.actions.verificarSegundoFactor(undefined, form)).error)
    assert.equal(h.calls.length, 0)
  }
})

test('valid MFA preserves the original destination and password recovery, with refreshed layout', async () => {
  for (const siguiente of ['/fichas?q=Ana', '/restablecer', `/invitacion/admin?id=${id}&continuar=1`, '//evil.test', '/login/verificar']) {
    const h = harness()
    await assert.rejects(h.actions.verificarSegundoFactor(undefined, datos(id, '012345', siguiente)), e => e.path === destinoSegundoFactor(siguiente))
    assert.equal(h.calls[0][0], 'verify')
    assert.equal(h.calls.some(c => c[0] === 'revalidate'), true)
    if (siguiente === '/restablecer' || siguiente.startsWith('/invitacion/')) assert.equal(h.calls.some(c => c[0] === 'destination'), false)
  }
})

test('failed and throttled verification never navigate or revoke a factor', async () => {
  for (const status of [400, 429, 500]) {
    const h = harness({ verifyError: { status } })
    assert.ok((await h.actions.verificarSegundoFactor(undefined, datos())).error)
    assert.ok((await h.actions.desactivarDosFactores(datos())).error)
    assert.equal(h.calls.every(c => c[0] === 'verify'), true)
  }
})

test('turning 2FA off verifies a fresh code before unenrolling and refreshing the session', async () => {
  const h = harness()
  await assert.rejects(h.actions.desactivarDosFactores(datos()), e => e.path === '/perfil?dos_factores=desactivada#seguridad')
  assert.deepEqual(h.calls.map(c => c[0]), ['verify', 'unenroll', 'refresh', 'revalidate'])
  const failure = harness({ unenrollError: new Error('Unavailable') })
  assert.ok((await failure.actions.desactivarDosFactores(datos())).error)
  assert.deepEqual(failure.calls.map(c => c[0]), ['verify', 'unenroll'])
})

test('if session refresh fails after removal, sign out safely instead of leaving stale cookies', async () => {
  const h = harness({ refreshError: new Error('Offline') })
  await assert.rejects(h.actions.desactivarDosFactores(datos()), e => e.path === '/login')
  assert.deepEqual(h.calls.map(c => c[0]), ['verify', 'unenroll', 'refresh', 'signOut'])
})

test('profile suggests voluntary setup and has accessible code entry that preserves leading zeroes', () => {
  const codigo = cargarTS('components/codigo-dos-factores.tsx')
  const panel = cargarTS('components/seguridad-dos-factores.tsx', {
    '@/components/codigo-dos-factores': codigo,
    '@/components/mensaje-form': cargarTS('components/mensaje-form.tsx'),
    '@/lib/actions/dos-factores': {},
  }).SeguridadDosFactores
  const html = renderToStaticMarkup(createElement(panel, { factores: [], disponible: true }))
  assert.match(html, /Le sugerimos activarla/)
  assert.match(html, /completamente opcional/)
  assert.match(html, /Activar verificación en dos pasos/)
  const input = renderToStaticMarkup(createElement(codigo.CodigoDosFactores))
  assert.match(input, /type="text"/)
  assert.match(input, /inputMode="numeric"/)
  assert.match(input, /autoComplete="one-time-code"/)
  assert.match(input, /aria-describedby=/)
})

test('a server-confirmed factor hides any leftover enrollment secret when the profile updates', () => {
  let hook = 0
  const panel = cargarTS('components/seguridad-dos-factores.tsx', {
    react: {
      useState: initial => [hook++ === 0 ? { factorId: id, qr: 'sensitive-qr', secreto: 'sensitive-secret' } : initial, () => {}],
      useTransition: () => [false, () => {}],
    },
    '@/components/codigo-dos-factores': cargarTS('components/codigo-dos-factores.tsx'),
    '@/components/mensaje-form': cargarTS('components/mensaje-form.tsx'),
    '@/lib/actions/dos-factores': {},
  }).SeguridadDosFactores
  const html = renderToStaticMarkup(createElement(panel, { factores: [{ id, nombre: 'Autenticador' }], disponible: true }))
  assert.match(html, /Activada/)
  assert.match(html, /Desactivar verificación en dos pasos/)
  assert.doesNotMatch(html, /sensitive-secret|sensitive-qr|Confirmar y activar|Clave de configuración/)
})
