import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'
import { cargarTS } from './helpers/cedula-mocks.mjs'

const require = createRequire(import.meta.url)
const { PostgrestClient } = require('@supabase/postgrest-js')
const util = cargarTS('lib/util.ts')
const input = {
  personaId: 42, identificacion: '', nombre: 'Persona', apellido1: 'Prueba',
  comentario: 'Pagó a tiempo y entregó la propiedad en buen estado.',
  autorId: 7, etiquetas: [], anonima: true,
}

function dal({ rol = 'admin', activo = true, servicio = true, duplicada = false } = {}) {
  const requests = [], moderaciones = []
  const usuario = { id: 7, rol, activo, auth_user_id: 'auth-id' }
  function client(contexto) {
    const rest = new PostgrestClient('https://example.test/rest/v1', { fetch: async (url, init) => {
      const path = new URL(url).pathname
      const body = init.body ? JSON.parse(init.body) : null
      requests.push({ contexto, path, method: init.method, body })
      let status = 200
      let data
      if (path.endsWith('/usuarios')) data = usuario
      else if (/\/(?:mi_)?sesion_administracion_vigente$/.test(path)) data = true
      else if (path.endsWith('/personas')) data = { id: 42, identificacion: '102340567' }
      else if (path.endsWith('/resenas') && contexto === 'sesion') {
        // Production sessions cannot SELECT the version returned by this INSERT.
        status = 403
        data = { code: '42501', message: 'permission denied for table resenas' }
      } else if (path.endsWith('/resenas') && duplicada) {
        status = 409
        data = { code: '23505', message: 'duplicate key violates resenas_autor_persona_unica' }
      } else if (path.endsWith('/resenas')) data = { id: 3, version: 1 }
      else if (path.endsWith('/resena_etiquetas')) data = null
      else assert.fail(`Unexpected request ${path}`)
      return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
    } })
    return {
      from: table => rest.from(table), rpc: (...args) => rest.rpc(...args),
      auth: {
        getUser: async () => ({ data: { user: { id: 'auth-id' } } }),
        getClaims: async () => ({ data: { claims: {
          sub: 'auth-id', session_id: '11111111-1111-4111-8111-111111111111',
        } } }),
      },
    }
  }
  const session = client('sesion'), admin = client('servicio')
  const api = cargarTS('lib/dal.ts', {
    'server-only': {}, react: { cache: fn => fn }, 'next/navigation': {},
    '@/lib/facebook-alta': {}, '@/lib/facebook-auth': { cuentaCreadaConFacebook: () => false },
    '@/lib/util': util, '@/lib/padron': { consultarCedula: async () => ({ estado: 'no_disponible' }) },
    '@/lib/supabase/admin': { createAdmin: () => servicio ? admin : null },
    '@/lib/supabase/server': { sinSupabase: () => false, createClient: async () => session },
    '@/lib/moderacion-automatica': { intentarAprobacionAutomatica: async datos => {
      moderaciones.push(datos)
      return false
    } },
  })
  return { api, requests, moderaciones }
}

test('administrators save published reviews and tags despite private version permissions', async () => {
  const { api, requests, moderaciones } = dal()
  const result = await api.crearResena({ ...input, etiquetas: [9] })
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { resenaId: 3, personaId: 42, enRevision: false })
  const review = requests.find(r => r.path.endsWith('/resenas'))
  assert.equal(review.contexto, 'servicio')
  assert.equal(review.body.estado, 'publicada')
  assert.equal(review.body.autor_id, 7)
  assert.equal(review.body.anonima, true)
  assert.equal(requests.find(r => r.path.endsWith('/resena_etiquetas')).contexto, 'servicio')
  assert.equal(moderaciones.length, 0)
})

test('ordinary authors still save drafts before automatic moderation', async () => {
  for (const rol of ['propietario', 'agencia']) {
    const { api, requests, moderaciones } = dal({ rol })
    assert.equal((await api.crearResena(input)).enRevision, true)
    const review = requests.find(r => r.path.endsWith('/resenas'))
    assert.equal(review.contexto, 'servicio')
    assert.equal(review.body.estado, 'borrador')
    assert.deepEqual(JSON.parse(JSON.stringify(moderaciones)), [{ id: 3, autorId: 7, version: 1 }])
  }
})

test('service writes still require an active session author and service configuration', async () => {
  for (const [options, datos, message] of [
    [{ activo: false }, input, /inactiva/],
    [{}, { ...input, autorId: 99 }, /otra cuenta/],
    [{ servicio: false }, input, /configuración de administración/],
  ]) {
    const { api, requests } = dal(options)
    await assert.rejects(api.crearResena(datos), message)
    assert.ok(!requests.some(r => r.path.endsWith('/resenas')))
  }
})

test('duplicate administrator reviews retain the actionable existing-review message', async () => {
  const { api } = dal({ duplicada: true })
  await assert.rejects(api.crearResena(input), /Ya tiene una; puede verla en su perfil/)
})
