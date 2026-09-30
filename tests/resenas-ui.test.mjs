import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const { PostgrestClient } = require('@supabase/postgrest-js')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, require: name => mocks[name] ?? require(name), console, URL, Date, Intl,
  }, { filename: file })
  return mod.exports
}

const util = load('lib/util.ts')
const mocks = {
  '@/lib/util': util,
  '@/components/avatar': load('components/avatar.tsx', { '@/lib/util': util }),
  '@/components/icono': load('components/icono.tsx'),
  '@/components/calificacion-estrellas': {
    CalificacionEstrellas: () => { throw new Error('Review UI must not render historical ratings') },
  },
  '@/components/form-denuncia': {
    FormDenuncia: ({ resenaId }) => createElement('form', { 'data-resena-denunciada': resenaId }),
  },
  '@/components/admin-formularios': { FormEditarResena: () => null, FormEliminarResena: () => null },
  '@/lib/correo-resenas': { correoResenasConfigurado: () => false },
  'next/link': ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
}
const { TarjetaFicha } = load('components/tarjeta-ficha.tsx', mocks)
const { TarjetaResena } = load('components/tarjeta-resena.tsx', mocks)

const resena = {
  id: 42, estado: 'publicada', tipo: 'inquilino', comentario: 'Compartió la experiencia con claridad.\nCumplió el acuerdo.',
  anonima: false, propia: false, verificada: true,
  autor: { id: 5, nombre: 'María Pérez', rol: 'propietario' }, creado_en: '2026-09-20T12:00:00Z',
  calificacion_id: null, calificacion: null, recomienda: null, drogas: null,
  dano: null, proceso: null, contrato: null, tipoAlquiler: null, tiempo: null, detalle_dano: null,
  fecha_inicio_alquiler: null, fecha_fin_alquiler: null, etiquetas: [], conductas: [], fotos: [],
}
const renderResena = (overrides = {}, props = {}) => renderToStaticMarkup(createElement(TarjetaResena, {
  resena: { ...resena, ...overrides }, puedeDenunciar: false, ...props,
}))
function sinCamposHistoricos(html) {
  assert.doesNotMatch(html, /Sin calificación|★|de 5|\/ 5|Contrato|Duración|Período|¿Lo alquilaría de nuevo\?|Reporte de sustancias|Detalle del daño/)
  assert.doesNotMatch(html, /HISTORICO_/)
}

test('review cards keep the comment and author while omitting all historical form fields', () => {
  const html = renderResena({
    calificacion_id: 1, calificacion: { id: 1, valor: 5, texto: 'HISTORICO_CALIFICACION' },
    recomienda: true, drogas: true,
    contrato: { id: 1, nombre: 'HISTORICO_CONTRATO' }, tipoAlquiler: { id: 1, nombre: 'HISTORICO_ALQUILER' },
    tiempo: { id: 1, nombre: 'HISTORICO_DURACION' }, dano: { id: 1, nombre: 'HISTORICO_DANO' },
    proceso: { id: 1, nombre: 'HISTORICO_PROCESO' }, detalle_dano: 'HISTORICO_DETALLE',
    etiquetas: [{ etiqueta: { id: 1, nombre: 'HISTORICO_ETIQUETA', tipo: 'inquilino' } }],
    conductas: [{ conducta: { nombre: 'HISTORICO_CONDUCTA' } }],
    fotos: [{ id: 1, resena_id: 42, url: 'https://example.test/HISTORICO_FOTO.jpg', descripcion: 'HISTORICO_FOTO', orden: 1 }],
    fecha_inicio_alquiler: '2012-01-01', fecha_fin_alquiler: '2013-12-31',
  })
  assert.match(html, /<article/)
  assert.ok(html.includes(resena.comentario))
  assert.match(html, /whitespace-pre-wrap/)
  assert.match(html, /María Pérez/)
  assert.match(html, /Propietario/)
  assert.match(html, /Verificada/)
  assert.ok(html.includes(util.fechaCorta(resena.creado_en)))
  assert.ok(!html.includes(util.fechaCorta('2012-01-01')))
  assert.ok(!html.includes(util.fechaCorta('2013-12-31')))
  sinCamposHistoricos(html)
})

test('historical reviews without a comment have an understandable content state', () => {
  for (const comentario of [null, '   ']) {
    const html = renderResena({ comentario, autor: null })
    assert.match(html, /Reseña importada/)
    assert.match(html, /Sin comentario\./)
    sinCamposHistoricos(html)
  }
})

test('anonymous owners see their status and privacy reassurance without their account identity', () => {
  const html = renderResena({ anonima: true, propia: true, estado: 'borrador', verificada: false })
  assert.match(html, /Anónimo/)
  assert.match(html, /Su reseña/)
  assert.match(html, /En revisión/)
  assert.match(html, /Su nombre no aparece en esta reseña\./)
  assert.doesNotMatch(html, /María Pérez|Propietario|Verificada/)
  assert.ok(html.includes(resena.comentario))
  sinCamposHistoricos(html)
})

test('moderation status and administrator visibility of anonymous authors remain explicit', () => {
  const html = renderResena({ anonima: true, estado: 'oculta' }, { esAdmin: true })
  assert.match(html, /María Pérez/)
  assert.match(html, /Propietario/)
  assert.match(html, /Anónima/)
  assert.match(html, /Rechazada/)
  sinCamposHistoricos(html)
})

test('report disclosure follows permission and comments render as text', () => {
  const comentario = '<script>alert("reseña")</script>'
  const permitido = renderResena({ comentario }, { puedeDenunciar: true })
  assert.match(permitido, /<details[^>]*>/)
  assert.match(permitido, /Denunciar esta reseña/)
  assert.match(permitido, /data-resena-denunciada="42"/)
  assert.match(permitido, /&lt;script&gt;/)
  assert.doesNotMatch(permitido, /<script>/)
  assert.doesNotMatch(renderResena(), /Denunciar esta reseña|data-resena-denunciada/)
})

test('search cards preserve navigation, masked identity and publication counts without ratings', () => {
  const ficha = {
    persona: { id: 7, nombre: 'Ana', nombre2: null, apellido1: 'Solís', apellido2: null, identificacion: '123456789', foto_url: null },
    provincia: 'San José', resenas: 2, ultima: '2026-09-20T12:00:00Z', promedio: 4.5,
  }
  const render = (overrides = {}) => renderToStaticMarkup(createElement(TarjetaFicha, {
    ficha: { ...ficha, ...overrides }, href: '/fichas/7?q=Ana&pagina=2',
  }))
  const html = render()
  assert.match(html, /href="\/fichas\/7\?q=Ana&amp;pagina=2"/)
  assert.match(html, /Ana Solís/)
  assert.match(html, /San José/)
  assert.ok(html.includes(`Documento ${util.mascararCedula(ficha.persona.identificacion)}`))
  assert.doesNotMatch(html, /123456789/)
  assert.match(html, /2 reseñas/)
  assert.match(html, /Última reseña:/)
  assert.ok(html.includes(util.fechaCorta(ficha.ultima)))
  sinCamposHistoricos(html)
  const unica = render({ resenas: 1, promedio: null, ultima: null })
  assert.match(unica, /1 reseña/)
  assert.doesNotMatch(unica, /1 reseñas|Última reseña:/)
  sinCamposHistoricos(unica)
})

function dalFicha({ rol = 'propietario', permitido = true, servicio = true } = {}) {
  const usuario = { id: 5, nombre: 'Ana Oculta', rol, activo: true }
  const otroAutor = { id: 8, nombre: 'María Mora', rol: 'agencia' }
  const requests = []
  const rows = [
    { id: 42, estado: 'publicada', comentario: 'Reseña anónima', anonima: true, verificada: false, creado_en: '2026-09-20T12:00:00Z',
      ...(!servicio && { autor: usuario }) },
    { id: 43, estado: 'publicada', comentario: 'Reseña con nombre', anonima: false, verificada: false, creado_en: '2026-09-21T12:00:00Z',
      ...(!servicio && { autor: otroAutor }) },
  ]
  const privadas = [
    { id: 44, autor_id: usuario.id, estado: 'borrador', comentario: 'Mi reseña pendiente', anonima: true,
      detalle_verificacion: null, creado_en: '2026-09-22T12:00:00Z', autor: [{ nombre: usuario.nombre }] },
    { id: 45, autor_id: otroAutor.id, estado: 'oculta', comentario: 'Otra reseña rechazada', anonima: false,
      detalle_verificacion: 'No aprobada', creado_en: '2026-09-21T12:00:00Z', autor: { nombre: otroAutor.nombre } },
  ]
  const postgrest = new PostgrestClient('http://localhost/rest/v1', {
    fetch: async (url) => {
      const request = new URL(url)
      requests.push(request)
      const table = request.pathname.split('/').at(-1)
      let data
      if (table === 'usuarios') data = request.searchParams.has('auth_user_id') ? usuario : [usuario, otroAutor]
      else if (table === 'personas') data = { id: 7, nombre: 'Juan', apellido1: 'Solís', resenas: rows, provincia: null }
      else if (table === 'resenas') {
        if (request.searchParams.has('persona_id')) data = request.searchParams.has('autor_id') ? privadas.slice(0, 1) : privadas
        else data = request.searchParams.has('autor_id')
          ? [{ id: 42, persona_id: 7, estado: 'borrador', comentario: 'Reseña anónima', anonima: true,
            detalle_verificacion: null, creado_en: '2026-09-20T12:00:00Z',
            persona: { id: 7, nombre: 'Juan', nombre2: null, apellido1: 'Solís', apellido2: null } }]
          : [{ id: 42, autor_id: usuario.id, anonima: true }, { id: 43, autor_id: otroAutor.id, anonima: false }]
      }
      else throw new Error(`Unexpected catalog request: ${table}`)
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } })
    },
  })
  const db = {
    from: (table) => postgrest.from(table),
    auth: {
      getUser: async () => ({ data: { user: { id: 'auth-id' } } }),
      getClaims: async () => ({ data: { claims: { sub: 'auth-id', session_id: '11111111-1111-4111-8111-111111111111' } }, error: null }),
    },
    rpc: async (name) => name.includes('sesion_administracion_vigente')
      ? { data: true, error: null }
      : { data: [{ usuario_id: usuario.id, puede_consultar: permitido }], error: null },
  }
  const api = load('lib/dal.ts', {
    'server-only': {}, react: { cache: (fn) => fn }, 'next/navigation': {},
    '@/lib/facebook-alta': {}, '@/lib/facebook-auth': { cuentaCreadaConFacebook: () => false }, '@/lib/util': util,
    '@/lib/supabase/admin': { createAdmin: () => servicio ? db : null },
    '@/lib/supabase/server': { createClient: async () => db, sinSupabase: () => false },
  })
  return { api, requests, usuario, otroAutor }
}

test('simple ficha reads retain named attribution and anonymous ownership without catalog queries', async () => {
  for (const servicio of [true, false]) {
    const { api, requests, otroAutor } = dalFicha({ servicio })
    const ficha = await api.obtenerFicha(7)
    assert.equal(ficha.resenas.length, 2)
    assert.equal(ficha.resenas[0].propia, true)
    assert.equal(ficha.resenas[0].anonima, true)
    assert.equal(ficha.resenas[0].autor, null, 'anonymous owners still receive no visible account identity')
    assert.equal(ficha.resenas[1].propia, false)
    assert.equal(ficha.resenas[1].autor.nombre, otroAutor.nombre)
    const query = requests.find((request) => request.pathname.endsWith('/personas'))
    assert.equal(query.searchParams.get('id'), 'eq.7')
    assert.match(query.searchParams.get('select'), /id,estado,comentario,verificada,anonima,creado_en/)
    assert.doesNotMatch(query.searchParams.get('select'), /calificacion|fecha_inicio_alquiler|fecha_fin_alquiler|tipo_contrato|tipo_alquiler|tiempo_alquiler|dano|proceso|etiquetas|conductas|fotos/)
    assert.equal(requests.length, servicio ? 4 : 2)
  }
})

test('administrators retain anonymous author attribution in simple ficha reads', async () => {
  const { api, usuario } = dalFicha({ rol: 'admin' })
  const ficha = await api.obtenerFicha(7)
  assert.equal(ficha.resenas[0].autor.nombre, usuario.nombre)
  assert.equal(ficha.resenas[0].anonima, true)
  assert.equal(ficha.resenas[0].propia, true)
})

test('ficha access denial stops before tenant data or authorship is queried', async () => {
  for (const servicio of [true, false]) {
    const { api, requests } = dalFicha({ permitido: false, servicio })
    assert.equal(await api.obtenerFicha(7), null)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].pathname, '/rest/v1/usuarios')
  }
})

test('own profile reviews remain available before consultation access and request only current fields', async () => {
  for (const servicio of [true, false]) {
    const { api, requests, usuario } = dalFicha({ permitido: false, servicio })
    const propias = await api.listarResenasDe(usuario.id)
    assert.equal(propias.length, 1)
    assert.equal(propias[0].persona_id, 7)
    assert.equal(propias[0].persona.nombre, 'Juan')
    assert.equal(propias[0].estado, 'borrador')
    assert.equal(propias[0].comentario, 'Reseña anónima')
    assert.equal(propias[0].anonima, true)
    assert.equal(requests.length, 2)
    const query = requests.find((request) => request.pathname.endsWith('/resenas'))
    assert.equal(query.searchParams.get('autor_id'), `eq.${usuario.id}`)
    assert.equal(query.searchParams.get('order'), 'creado_en.desc')
    assert.match(query.searchParams.get('select'), /persona_id,estado,comentario,anonima,detalle_verificacion,creado_en/)
    assert.doesNotMatch(query.searchParams.get('select'), /\*|calificacion|fecha_inicio_alquiler|fecha_fin_alquiler|recomienda|drogas|dano|proceso|contrato|alquiler|etiquetas|conductas|fotos/)
  }
})

test('private reviews retain ownership while hiding ordinary author identities and raw author ids', async () => {
  for (const rol of ['propietario', 'admin']) {
    const { api, requests, usuario, otroAutor } = dalFicha({ rol })
    const privadas = await api.resenasPrivadasVisibles(7, usuario)
    assert.equal(privadas.length, rol === 'admin' ? 2 : 1)
    assert.equal(privadas[0].propia, true)
    assert.equal(privadas[0].anonima, true)
    assert.equal(privadas[0].estado, 'borrador')
    assert.equal(privadas[0].comentario, 'Mi reseña pendiente')
    assert.equal(privadas[0].autor, rol === 'admin' ? usuario.nombre : null)
    if (rol === 'admin') {
      assert.equal(privadas[1].propia, false)
      assert.equal(privadas[1].autor, otroAutor.nombre)
    }
    assert.ok(privadas.every((fila) => !Object.hasOwn(fila, 'autor_id')))
    assert.equal(requests.length, 1)
    const [query] = requests
    assert.equal(query.pathname, '/rest/v1/resenas')
    assert.equal(query.searchParams.get('persona_id'), 'eq.7')
    assert.equal(query.searchParams.get('estado'), 'neq.publicada')
    assert.equal(query.searchParams.get('autor_id'), rol === 'admin' ? null : `eq.${usuario.id}`)
    assert.equal(query.searchParams.get('order'), 'creado_en.desc')
    assert.equal(query.searchParams.get('limit'), '20')
  }
  const sinServicio = dalFicha({ servicio: false })
  assert.equal((await sinServicio.api.resenasPrivadasVisibles(7, sinServicio.usuario)).length, 0)
  assert.equal(sinServicio.requests.length, 0)
})
