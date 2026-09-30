import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = new URL('../', import.meta.url)

function cargar(ruta, mocks = {}) {
  const archivo = new URL(ruta, root)
  const codigo = ts.transpileModule(readFileSync(archivo, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
  const modulo = { exports: {} }
  vm.runInNewContext(codigo, {
    module: modulo,
    exports: modulo.exports,
    require: nombre => nombre in mocks ? mocks[nombre] : require(nombre),
    URL,
    URLSearchParams,
  }, { filename: archivo.pathname })
  return modulo.exports
}

const util = cargar('lib/util.ts')
const usuario = { id: 7, nombre: 'María Solís', rol: 'propietario', activo: true }
const resena = {
  id: 42,
  estado: 'publicada',
  comentario: 'Compartió una experiencia concreta sobre los pagos y la entrega.',
  creado_en: '2026-09-20T12:00:00Z',
  autor: { id: 9, nombre: 'Carlos Mora', rol: 'agencia' },
  anonima: false,
  propia: false,
  verificada: false,
  calificacion: { valor: 5, texto: 'HISTORICO_CALIFICACION' },
  fecha_inicio_alquiler: '2012-01-01',
  fecha_fin_alquiler: '2013-12-31',
  contrato: { nombre: 'HISTORICO_CONTRATO' },
  tipoAlquiler: { nombre: 'HISTORICO_ALQUILER' },
  tiempo: { nombre: 'HISTORICO_DURACION' },
  recomienda: true,
  etiquetas: [{ etiqueta: { nombre: 'HISTORICO_ETIQUETA' } }],
  dano: { nombre: 'HISTORICO_DANO' },
  detalle_dano: 'HISTORICO_DETALLE',
}

const comunes = {
  'next/link': ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
  '@/lib/util': util,
  '@/lib/correo-resenas': { correoResenasConfigurado: () => false },
  '@/components/admin-formularios': { FormEditarResena: () => null, FormEliminarResena: () => null },
  '@/components/avatar': { Avatar: () => null },
  '@/components/form-denuncia': { FormDenuncia: () => null },
  '@/components/calificacion-estrellas': {
    CalificacionEstrellas: () => { throw new Error('Ficha must not render historical ratings') },
  },
}
const { TarjetaResena } = cargar('components/tarjeta-resena.tsx', comunes)

function pagina({ sesion = usuario, publicadas = [resena], privadas = [], consulta = true } = {}) {
  const solicitudes = { fichas: [], destinos: [] }
  const Page = cargar('app/fichas/[id]/page.tsx', {
    ...comunes,
    'next/navigation': { notFound: () => { throw new Error('notFound') } },
    '@/lib/supabase/server': { sinSupabase: () => false },
    '@/components/aviso-configuracion': { AvisoConfiguracion: () => null },
    '@/components/espera-aprobacion': { EsperaAprobacion: () => createElement('p', null, 'Permiso de consulta requerido') },
    '@/components/tarjeta-resena': { TarjetaResena },
    '@/components/estado-vacio': { EstadoVacio: ({ titulo, texto }) => createElement('div', null,
      createElement('h2', null, titulo), createElement('p', null, texto)) },
    '@/lib/dal': {
      requireUsuario: async destino => { solicitudes.destinos.push(destino); return sesion },
      obtenerUsuario: async () => sesion,
      puedeConsultar: async () => consulta,
      obtenerFicha: async id => {
        solicitudes.fichas.push(id)
        return {
          id: 12, identificacion: '102340567', nombre: 'Ana', nombre2: null,
          apellido1: 'Vargas', apellido2: null, provincia: null, resenas: publicadas,
        }
      },
      resenasPrivadasVisibles: async () => privadas,
    },
  }).default
  return {
    solicitudes,
    render: async (searchParams = {}) => renderToStaticMarkup(await Page({
      params: Promise.resolve({ id: '12' }),
      searchParams: Promise.resolve(searchParams),
    })),
  }
}

function hrefDe(html, texto) {
  const enlace = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .find(([, , contenido]) => contenido.trim() === texto)
  assert.ok(enlace, `Missing link: ${texto}`)
  return enlace[1].replaceAll('&amp;', '&')
}

test('ficha summaries use only published count and latest review date while historical fields stay out of the rendered route', async () => {
  const ultima = '2026-09-23T12:00:00Z'
  const p = pagina({ publicadas: [
    { ...resena, id: 43, creado_en: ultima },
    resena,
    { ...resena, id: 44, estado: 'borrador', creado_en: '2026-09-29T12:00:00Z', comentario: 'BORRADOR_NO_PUBLICADO' },
  ] })
  const html = await p.render()
  const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1]
  assert.ok(header)
  assert.match(header, /2 reseñas publicadas/)
  assert.match(header, /Última reseña:/)
  assert.match(header, /<time dateTime="2026-09-23T12:00:00Z">/)
  assert.ok(header.includes(util.fechaCorta(ultima)))
  assert.ok(html.includes(resena.comentario))
  assert.match(html, /Carlos Mora/)
  assert.doesNotMatch(html, /HISTORICO_|BORRADOR_NO_PUBLICADO|★|Sin calificación|de 5|\/ 5|Contrato|Duración|Período|¿Lo alquilaría de nuevo\?/)
  assert.ok(!html.includes(util.fechaCorta(resena.fecha_inicio_alquiler)))
  assert.ok(!html.includes(util.fechaCorta(resena.fecha_fin_alquiler)))
})

test('an own published review changes the ficha action to the existing review in the profile', async () => {
  const p = pagina({ publicadas: [{ ...resena, propia: true, anonima: true }] })
  const html = await p.render()
  assert.equal(hrefDe(html, 'Ver mi reseña'), '/perfil#mis-resenas')
  assert.match(html, /1 reseña publicada/)
  assert.doesNotMatch(html, /Escribir reseña|href="\/resenas\/nueva/)
})

test('owners and administrators with their pending or rejected review resume it without a duplicate CTA', async () => {
  for (const estado of ['borrador', 'oculta']) {
    for (const rol of ['propietario', 'admin']) {
      const p = pagina({ sesion: { ...usuario, rol }, publicadas: [], privadas: [{
        id: 43, estado, propia: true, comentario: 'Mi experiencia todavía privada.', anonima: true,
        creado_en: '2026-09-21T12:00:00Z', autor: null, detalle_verificacion: null,
      }] })
      const html = await p.render()
      assert.equal(hrefDe(html, 'Ver mi reseña'), '/perfil#mis-resenas')
      assert.match(html, /0 reseñas publicadas|Aún no hay reseñas publicadas/)
      assert.match(html, /Mi experiencia todavía privada\./)
      assert.doesNotMatch(html, /Escribir reseña|href="\/resenas\/nueva|Última reseña:/)
    }
  }
})

test('another author’s private review does not prevent administrators from writing their own review', async () => {
  const p = pagina({ sesion: { ...usuario, rol: 'admin' }, privadas: [{
    id: 43, estado: 'borrador', propia: false, comentario: 'Reseña de otra persona.', anonima: false,
    creado_en: '2026-09-25T12:00:00Z', autor: 'Otra persona', detalle_verificacion: null,
  }] })
  const html = await p.render({ q: 'Ana', pagina: '2' })
  const url = new URL(hrefDe(html, 'Escribir reseña'), 'https://example.test')
  assert.equal(url.pathname, '/resenas/nueva')
  assert.equal(url.searchParams.get('personaId'), '12')
  assert.equal(url.searchParams.get('q'), 'Ana')
  assert.equal(url.searchParams.get('pagina'), '2')
  assert.doesNotMatch(html, /Ver mi reseña/)
})

test('the new-review CTA and result return link preserve encoded search and pagination', async () => {
  const p = pagina()
  const html = await p.render({ q: ['Ana & Solís', 'Otro'], pagina: ['3', '8'] })
  const url = new URL(hrefDe(html, 'Escribir reseña'), 'https://example.test')
  assert.equal(url.searchParams.get('q'), 'Ana & Solís')
  assert.equal(url.searchParams.get('pagina'), '3')
  assert.equal(url.searchParams.get('personaId'), '12')
  assert.equal(hrefDe(html, '← Volver a los resultados'), '/fichas?q=Ana+%26+Sol%C3%ADs&pagina=3')
  assert.deepEqual(p.solicitudes.destinos, ['/fichas/12?q=Ana+%26+Sol%C3%ADs&pagina=3'])
})

test('ficha access recovery renders before loading any tenant or review data', async () => {
  const p = pagina({ consulta: false })
  const html = await p.render()
  assert.match(html, /Permiso de consulta requerido/)
  assert.doesNotMatch(html, /Ana Vargas|102340567|Carlos Mora|Escribir reseña|Ver mi reseña/)
  assert.deepEqual(p.solicitudes.fichas, [])
})
