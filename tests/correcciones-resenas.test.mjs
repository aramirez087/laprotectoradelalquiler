import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cargarTS, mocksCedula } from './helpers/cedula-mocks.mjs'

const require = createRequire(import.meta.url)
const { PostgrestClient } = require('@supabase/postgrest-js')
const util = cargarTS('lib/util.ts')
const original = 'Pagó a tiempo y entregó la propiedad en buen estado.'
const edited = 'Precisé los hechos sobre los pagos y la entrega de la propiedad.'

function dal({ activo = true, error = null } = {}) {
  const requests = []
  const usuario = { id: 7, rol: 'propietario', activo, auth_user_id: 'auth-id' }
  const rest = new PostgrestClient('https://example.test/rest/v1', { fetch: async (url, init) => {
    const path = new URL(url).pathname
    const body = init.body ? JSON.parse(init.body) : null
    requests.push({ path, body })
    const data = path.endsWith('/usuarios') ? usuario
      : path.endsWith('/sesion_administracion_vigente') ? true
      : path.endsWith('/corregir_resena') ? error ?? { persona_id: 42 }
      : path.endsWith('/historial_resenas') ? [] : null
    assert.notEqual(data, null, `Unexpected request ${path}`)
    return new Response(JSON.stringify(data), { status: error && path.endsWith('/corregir_resena') ? 400 : 200,
      headers: { 'content-type': 'application/json' } })
  } })
  const db = {
    from: table => rest.from(table), rpc: (...args) => rest.rpc(...args),
    auth: {
      getUser: async () => ({ data: { user: { id: 'auth-id' } } }),
      getClaims: async () => ({ data: { claims: { sub: 'auth-id', session_id: '11111111-1111-4111-8111-111111111111' } } }),
    },
  }
  const api = cargarTS('lib/dal.ts', {
    'server-only': {}, react: { cache: fn => fn }, 'next/navigation': {},
    '@/lib/facebook-alta': {}, '@/lib/facebook-auth': { cuentaCreadaConFacebook: () => false },
    '@/lib/util': util, '@/lib/padron': mocksCedula['@/lib/padron'],
    '@/lib/supabase/admin': { createAdmin: () => db },
    '@/lib/supabase/server': { sinSupabase: () => false, createClient: async () => db },
  })
  return { api, requests }
}

test('correction RPC uses the authenticated owner and accepts only review content and version', async () => {
  const { api, requests } = dal()
  assert.equal(await api.corregirResena({ id: 1, version: 2, comentario: edited, anonima: false,
    autorId: 99, personaId: 999, estado: 'publicada', permite_correccion: true }), 42)
  const rpc = requests.find(r => r.path.endsWith('/corregir_resena'))
  assert.deepEqual(rpc.body, { p_autor_id: 7, p_id: 1, p_version: 2, p_comentario: edited, p_anonima: false })
})

test('inactive authors stop before mutation and database policy errors remain actionable', async () => {
  const inactive = dal({ activo: false })
  await assert.rejects(inactive.api.corregirResena({ id: 1, version: 2, comentario: edited, anonima: false }), /inactiva/)
  assert.ok(!inactive.requests.some(r => r.path.endsWith('/corregir_resena')))
  for (const message of ['No encontramos esa reseña en su cuenta.',
    'La reseña cambió desde que la abrió. Vuelva a su perfil y revise su estado.',
    'Esta reseña no admite correcciones. Revise su estado en el perfil.']) {
    const a = dal({ error: { code: 'P0001', message } })
    await assert.rejects(a.api.corregirResena({ id: 1, version: 2, comentario: edited, anonima: false }),
      error => error instanceof a.api.AvisoCorreccion && error.message === message)
  }
})

test('history is read as the session user and requests batch all owned reviews', async () => {
  const { api, requests } = dal()
  await api.historialResenas(Array.from({ length: 41 }, (_, i) => i + 1))
  const calls = requests.filter(r => r.path.endsWith('/historial_resenas'))
  assert.deepEqual(calls.map(r => r.body.p_resena_ids.length), [20,20,1])
  assert.ok(calls.every(r => r.body.p_usuario_id === 7))
  assert.equal((await dal({ activo: false }).api.historialResenas([1])).length, 0)
})

function action({ activo = true, failure = null } = {}) {
  const saved = [], revalidated = []
  class AvisoCorreccion extends Error {}
  const api = cargarTS('lib/actions/resenas.ts', {
    '@/lib/dal': { AvisoCorreccion, requireUsuario: async () => ({ id: 7, activo }),
      corregirResena: async input => { if (failure) throw new AvisoCorreccion(failure); saved.push(input); return 42 } },
    '@/lib/util': {},
    'next/cache': { revalidatePath: path => revalidated.push(path) },
    'next/navigation': {
      redirect: path => { throw new Error(`redirect:${path}`) },
      unstable_rethrow: error => { if (error.message?.startsWith('redirect:')) throw error },
    },
  })
  return { ...api, saved, revalidated }
}
function form() {
  const f = new FormData()
  for (const [key, value] of Object.entries({ id: '1', version: '2', comentario: edited, anonima: '1', autorId: '99', estado: 'publicada' })) f.set(key, value)
  return f
}

test('valid corrected submissions refresh moderation and return to the existing profile review', async () => {
  const a = action()
  await assert.rejects(a.corregirResenaAction(undefined, form()), /redirect:\/perfil\?corregida=1#mis-resenas/)
  assert.deepEqual(JSON.parse(JSON.stringify(a.saved[0])), { id: 1, version: 2, comentario: edited, anonima: true })
  for (const route of ['/perfil','/fichas/42','/admin/revision','/admin/rechazadas']) assert.ok(a.revalidated.includes(route))
})

test('invalid, stale and inactive submissions do not replace the typed correction or report success', async () => {
  for (const [field, value] of [['comentario','short'], ['version',''], ['id','-1']]) {
    const a = action(), f = form(); f.set(field, value)
    const response = await a.corregirResenaAction(undefined, f)
    assert.ok(response.campos[field])
    assert.equal(a.saved.length, 0)
    assert.equal(f.get('comentario'), field === 'comentario' ? 'short' : edited)
  }
  const stale = action({ failure: 'La reseña cambió desde que la abrió. Vuelva a su perfil y revise su estado.' })
  assert.match((await stale.corregirResenaAction(undefined, form())).error, /cambió desde/)
  assert.equal(stale.revalidated.length, 0)
  const inactive = action({ activo: false })
  assert.match((await inactive.corregirResenaAction(undefined, form())).error, /inactiva/)
  assert.equal(inactive.saved.length, 0)
})

const formMocks = {
  '@/lib/actions/resenas': { corregirResenaAction: () => {} },
  '@/components/use-form-action': { useFormAction: () => ({ estado: undefined, pendiente: false, formProps: {} }) },
  '@/components/mensaje-form': { MensajeForm: () => null },
}
const formComponent = cargarTS('components/form-corregir-resena.tsx', formMocks)

test('the correction form prefills text and anonymity and uses unique accessible labels', () => {
  const html = renderToStaticMarkup(createElement(formComponent.FormCorregirResena, { id: 42, version: 2, comentario: original, anonima: true }))
  assert.match(html, /Corregir y reenviar/)
  assert.match(html, /name="version" value="2"/)
  assert.match(html, /for="correccion-42"/)
  assert.match(html, /aria-describedby="correccion-42-ayuda"/)
  assert.ok(html.includes(original))
  assert.match(html, /name="anonima"[^>]*checked=""/)
  assert.match(html, /Reenviar a revisión/)
  assert.doesNotMatch(html, /name="personaId"|name="autorId"|name="estado"/)
})

test('profiles offer correction only to active authors when moderation allows it', async () => {
  for (const activo of [true,false]) for (const permite_correccion of [true,false]) for (const estado of ['oculta','borrador','publicada']) {
    const profile = cargarTS('app/perfil/page.tsx', {
      '@/lib/dal': {
        requireUsuario: async () => ({ id: 7, nombre: 'Author', email: 'author@example.test', rol: 'propietario', activo }),
        accesoConsulta: async () => ({ puede_consultar: false }), perfilFacebookDe: async () => null, horaServidor: () => '',
        historialResenas: async () => [],
        listarResenasDe: async () => [{ id: 42, version: 2, estado, permite_correccion, comentario: original, anonima: true,
          detalle_verificacion: 'Precise los hechos.', creado_en: '2026-10-01', persona: { id: 1, nombre: 'Ana', apellido1: 'Solís' } }],
      },
      '@/components/form-clave': { FormClave: () => null }, '@/components/permiso-consulta': { PanelPermiso: () => null },
      '@/lib/actions/auth': { cerrarSesion: () => {} },
      '@/lib/facebook-auth': { authFacebookHabilitado: () => false, mensajeErrorFacebook: () => null },
      '@/lib/supabase/server': { sinSupabase: () => false }, '@/lib/util': util,
      '@/components/avatar': { Avatar: () => null }, '@/components/icono': { Icono: () => null },
      '@/components/perfil-facebook': { PerfilFacebook: () => null },
      '@/components/form-corregir-resena': formComponent,
      '@/components/historial-resena': mocksCedula['@/components/historial-resena'],
    })
    const html = renderToStaticMarkup(await profile.default({ searchParams: Promise.resolve({}) }))
    assert.equal(html.includes('Corregir y reenviar'), activo && permite_correccion && estado === 'oculta')
    assert.ok(html.includes(original))
  }
})
