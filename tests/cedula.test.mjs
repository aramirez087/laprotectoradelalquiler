import assert from 'node:assert/strict'
import test from 'node:test'
import { gzipSync } from 'node:zlib'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cargarTS } from './helpers/cedula-mocks.mjs'
import { fechaPublicada, leerElector } from '../scripts/padron-tse.mjs'

const cedula = cargarTS('lib/cedula.ts')
const persona = cedula.nombreDePadron('102340567', 'MARÍA DEL CARMEN', 'SOLÍS', 'MUÑOZ')

test('only nine-digit national documents reach the TSE index', () => {
  for (const valor of ['102340567', ' 1-0234-0567 ', '1 0234 0567']) assert.equal(cedula.cedulaNacional(valor), '102340567')
  for (const valor of ['DIMEX123456789012', '3101123456', 'ABC102340567', '012345678', '1/0234/0567', '', null]) assert.equal(cedula.cedulaNacional(valor), null)
})

test('official date parsing and freshness reject invalid, future and old snapshots', () => {
  assert.equal(fechaPublicada('<h1>actualizado al 31 de agosto 2026</h1>'), '2026-08-31')
  assert.equal(fechaPublicada('actualizado al 30 de setiembre de 2026'), '2026-09-30')
  assert.throws(() => fechaPublicada('actualizado al 31 de febrero 2026'))
  assert.throws(() => fechaPublicada('Sin fecha'))
  const hoy = Date.parse('2026-09-30T12:00:00Z')
  assert.equal(cedula.padronVigente('2026-08-31', hoy), true)
  for (const fecha of ['2026-06-30', '2026-10-01', '2026-02-31', 'invalid']) assert.equal(cedula.padronVigente(fecha, hoy), false)
})

test('official CSV preserves compound given names, accents and an empty second surname', () => {
  const linea = leerElector('102340567,108001,1,20300101,00000,MARÍA DEL CARMEN               ,SOLÍS                     ,                          ')
  assert.equal(linea, '102340567\tMARÍA DEL CARMEN\tSOLÍS\t')
  const nombre = cedula.buscarEnFragmento([linea], '102340567')
  assert.equal(nombre.nombre, 'MARÍA')
  assert.equal(nombre.nombre2, 'DEL CARMEN')
  assert.equal(nombre.apellido2, '')
  assert.equal(nombre.nombreCompleto, 'MARÍA DEL CARMEN SOLÍS')
  assert.throws(() => leerElector('102340567,changed format'))
  assert.equal(cedula.buscarEnFragmento([linea], '102340568'), null)
})

function padron({ fecha = new Date().toISOString().slice(0, 10), prefijos = ['102'], downloadError = false, fallosManifiesto = 0, reloj = Date, contenido = '102340567\tMARÍA DEL CARMEN\tSOLÍS\tMUÑOZ\n' } = {}) {
  let descargas = 0, manifiestos = 0
  const db = {
    from: () => ({ select() { return this }, eq() { return this }, maybeSingle: async () => { manifiestos++; return fallosManifiesto-- > 0 ? { error: { code: '503' }, data: null } : ({ data: { version: `${fecha}-abcdef0123456789`, fecha_padron: fecha, prefijos }, error: null }) } }),
    storage: { from: bucket => {
      assert.equal(bucket, 'padron-tse')
      return { download: async path => {
        assert.match(path, /102\.txt\.gz$/)
        descargas++
        return downloadError ? { error: new Error('offline'), data: null } : { error: null, data: new Blob([gzipSync(contenido)]) }
      } }
    } },
  }
  const api = cargarTS('lib/padron.ts', {
    'server-only': {}, react: { cache: f => f }, '@/lib/cedula': cedula,
    '@/lib/supabase/admin': { createAdmin: () => db },
  }, { Date: reloj })
  return { ...api, get descargas() { return descargas }, get manifiestos() { return manifiestos } }
}

test('shared manifests refresh after 30 seconds and failed reads recover on the next request', async () => {
  let ahora = Date.now()
  class Reloj extends Date { static now() { return ahora } }
  const api = padron({ reloj: Reloj })
  await Promise.all([api.consultarCedula('102340567'), api.consultarCedula('102340568')])
  assert.equal(api.manifiestos, 1)
  assert.equal(api.descargas, 1)
  ahora += 30_001
  await api.consultarCedula('102340567')
  assert.equal(api.manifiestos, 2)
  assert.equal(api.descargas, 1)
  const recuperable = padron({ fallosManifiesto: 1 })
  assert.equal((await recuperable.consultarCedula('102340567')).estado, 'no_disponible')
  assert.equal((await recuperable.consultarCedula('102340567')).estado, 'encontrada')
  assert.equal(recuperable.manifiestos, 2)
})

test('server checks official names and reuses immutable fragments without returning the whole index', async () => {
  const api = padron()
  const resultado = await api.consultarCedula('1-0234-0567')
  assert.equal(resultado.estado, 'encontrada')
  assert.equal(resultado.persona.nombreCompleto, persona.nombreCompleto)
  assert.equal((await api.consultarCedula('102340568')).estado, 'no_encontrada')
  assert.equal((await api.consultarCedula('999999999')).estado, 'no_encontrada')
  assert.equal(api.descargas, 1)
  assert.equal(api.manifiestos, 1)
})

test('unavailable, malformed and stale data never produce a verified status', async () => {
  assert.equal((await padron({ downloadError: true }).consultarCedula('102340567')).estado, 'no_disponible')
  assert.equal((await padron({ contenido: '102340567\tWrong\n' }).consultarCedula('102340567')).estado, 'no_disponible')
  assert.equal((await padron({ fecha: '2020-01-01' }).consultarCedula('102340567')).estado, 'desactualizado')
  assert.equal((await padron().consultarCedula('DIMEX-123')).estado, 'no_aplica')
})

test('a blank second surname at the end of a shard is still found', async () => {
  const api = padron({ contenido: '102340567\tMARÍA\tSOLÍS\t\n' })
  const resultado = await api.consultarCedula('102340567')
  assert.equal(resultado.estado, 'encontrada')
  assert.equal(resultado.persona.apellido2, '')
})

test('lookup endpoint enforces origin, body limits and a server-side quota before reading names', async () => {
  const secretoAnterior = process.env.SUPABASE_SECRET_KEY
  process.env.SUPABASE_SECRET_KEY = 'test-only-secret'
  try {
    let consultas = 0, cuota = true, claves = []
    const api = cargarTS('app/api/cedula/route.ts', {
      '@/lib/padron': { consultarCedula: async () => { consultas++; return { estado: 'encontrada', persona, fechaPadron: '2026-08-31' } } },
      '@/lib/cedula': cedula,
      '@/lib/supabase/admin': { createAdmin: () => ({ rpc: async (_nombre, args) => { claves.push(args.p_clave); return { data: cuota, error: null } } }) },
    })
    const request = (body, origin = 'https://protectora.test') => new Request('https://protectora.test/api/cedula', {
      method: 'POST', headers: { origin, 'x-forwarded-for': '127.0.0.1' }, body,
    })
    assert.equal((await api.POST(request('{"cedula":"102340567"}', 'https://evil.test'))).status, 403)
    assert.equal((await api.POST(request('{"cedula":"DIMEX-102340567"}'))).status, 422)
    assert.equal((await api.POST(request('x'.repeat(1025)))).status, 413)
    assert.equal(consultas, 0)
    const bien = await api.POST(request('{"cedula":"1-0234-0567"}'))
    assert.equal(bien.status, 200)
    assert.equal(bien.headers.get('cache-control'), 'private, no-store')
    assert.match(claves[0], /^[a-f0-9]{64}$/)
    cuota = false
    assert.equal((await api.POST(request('{"cedula":"102340567"}'))).status, 429)
    assert.equal(consultas, 1)
  } finally {
    if (secretoAnterior === undefined) delete process.env.SUPABASE_SECRET_KEY
    else process.env.SUPABASE_SECRET_KEY = secretoAnterior
  }
})

test('identity form renders cédula before name and keeps manual fields available without a match', async () => {
  const { mocksCedula } = await import('./helpers/cedula-mocks.mjs')
  const html = renderToStaticMarkup(createElement(mocksCedula['@/components/campos-identidad'].CamposIdentidad, { tipo: 'cuenta', campoCedula: 'cedula' }))
  assert.ok(html.indexOf('name="cedula"') < html.indexOf('name="nombre"'))
  assert.doesNotMatch(html, /readOnly/)
})

test('admin saves preserve administrator names and never consult the TSE', async () => {
  const llamadas = []
  const api = cargarTS('lib/admin.ts', {
    'server-only': {}, '@/lib/dal': { requerirRol: async () => ({ id: 7 }) },
    '@/lib/padron': { consultarCedula: async () => { throw new Error('Admin must not consult TSE') } },
    '@/lib/util': cargarTS('lib/util.ts'), '@/lib/periodo': {}, '@/lib/acceso-consulta': {},
    '@/lib/supabase/admin': { createAdmin: () => ({ rpc: (nombre, args) => {
      llamadas.push({ nombre, args })
      return { single: async () => ({ data: { id: 1, persona_id: 2, persona_anterior_id: 2, movida: false }, error: null }) }
    } }) },
  })
  await api.editarResena({ id: 1, identificacion: '1-0234-0567', nombre: 'Falso', nombre2: '', apellido1: 'Falso', apellido2: '', comentario: 'Test', anonima: false })
  assert.equal(llamadas[0].args.p_admin_id, 7)
  assert.equal(llamadas[0].args.p_nombre, 'Falso')
  assert.equal(llamadas[0].args.p_nombre2, '')
  assert.equal(llamadas[0].args.p_apellido1, 'Falso')
  await api.actualizarDatosUsuario({ id: 1, identificacion: '102340567', nombre: 'Falso', telefono: '', versionEsperada: 'original' })
  assert.equal(llamadas[1].args.p_nombre, 'Falso')
  assert.equal(llamadas[1].args.p_version_esperada, 'original')
})

test('new tenant saves use TSE names and preserve moderation without accepting a forged verification flag', async () => {
  const guardados = []
  const usuario = { id: 7, rol: 'propietario', activo: true }
  const db = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'auth-id' } } }),
      getClaims: async () => ({ data: { claims: { sub: 'auth-id', session_id: '11111111-1111-4111-8111-111111111111' } } }),
    },
    rpc: async () => ({ data: true, error: null }),
    from: tabla => {
      let escrito = false
      const q = {
        select: () => q, eq: () => q, ilike: () => q, limit: () => q,
        insert: datos => { guardados.push({ tabla, datos }); escrito = true; return q },
        maybeSingle: async () => ({ data: tabla === 'usuarios' ? usuario : null, error: null }),
        single: async () => ({ data: escrito ? { id: tabla === 'personas' ? 2 : 3 } : null, error: null }),
        then: resolve => resolve({ data: [], error: null }),
      }
      return q
    },
  }
  const api = cargarTS('lib/dal.ts', {
    'server-only': {}, react: { cache: f => f }, 'next/navigation': {},
    '@/lib/facebook-alta': {}, '@/lib/facebook-auth': { cuentaCreadaConFacebook: () => false },
    '@/lib/padron': { consultarCedula: async () => ({ estado: 'encontrada', persona, fechaPadron: '2026-08-31' }) },
    '@/lib/util': cargarTS('lib/util.ts'),
    '@/lib/supabase/admin': { createAdmin: () => db },
    '@/lib/supabase/server': { createClient: async () => db, sinSupabase: () => false },
  })
  const resultado = await api.crearResena({ identificacion: '102340567', nombre: 'Falso', apellido1: 'Falso', etiquetas: [], autorId: 7, verificada: true })
  assert.equal(resultado.enRevision, true)
  assert.equal(guardados[0].datos.nombre, persona.nombre)
  assert.equal(guardados[0].datos.nombre2, persona.nombre2)
  assert.equal(guardados[1].datos.estado, 'borrador')
  assert.equal(guardados[1].datos.verificada, undefined)
})

test('email signup resolves the TSE name on the server instead of trusting submitted metadata', async () => {
  let creado
  const q = { select() { return this }, eq() { return this }, ilike() { return this }, limit() { return this }, maybeSingle: async () => ({ data: null, error: null }), then: resolve => resolve({ data: [], error: null }) }
  const api = cargarTS('lib/actions/auth.ts', {
    'next/headers': { headers: async () => new Headers({ host: 'protectora.test' }) }, 'next/navigation': {},
    '@/lib/correo-recordado': {}, '@/lib/dal': {}, '@/lib/facebook-auth': {}, '@/lib/util': cargarTS('lib/util.ts'),
    '@/lib/padron': { consultarCedula: async () => ({ estado: 'encontrada', persona, fechaPadron: '2026-08-31' }) },
    '@/lib/supabase/admin': { createAdmin: () => ({ from: () => q }) },
    '@/lib/supabase/server': { sinSupabase: () => false, createClient: async () => ({ auth: { signUp: async datos => { creado = datos; return { error: null } } } }) },
  })
  const datos = new FormData()
  for (const [campo, valor] of Object.entries({ nombre: 'Nombre falsificado', cedula: '102340567', email: 'test@example.test', facebook: 'Perfil de prueba', clave: 'Password123', rol: 'propietario' })) datos.set(campo, valor)
  const resultado = await api.registrarse(undefined, datos)
  assert.ok(resultado.mensaje)
  assert.equal(creado.options.data.nombre, persona.nombreCompleto)
  assert.equal(creado.options.data.rol, 'propietario')
})

test('review validation accepts legal one-letter names from the padrón', async () => {
  let enviado
  const api = cargarTS('lib/actions/resenas.ts', {
    'next/navigation': { redirect: () => { throw new Error('redirect') }, unstable_rethrow: error => { if (error.message === 'redirect') throw error } },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/util': cargarTS('lib/util.ts'),
    '@/lib/dal': {
      requireUsuario: async () => ({ id: 7, activo: true }), listarResenasDe: async () => [],
      crearResena: async datos => { enviado = datos; return { personaId: 2, enRevision: true } },
    },
  })
  const datos = new FormData()
  for (const [campo, valor] of Object.entries({ nombre: 'A', apellido1: 'Q', identificacion: '102340567', comentario: 'Una experiencia de alquiler suficientemente detallada para revisión.' })) datos.set(campo, valor)
  await assert.rejects(api.crearResenaAction(undefined, datos), /redirect/)
  assert.equal(enviado.nombre, 'A')
  assert.equal(enviado.apellido1, 'Q')
})
