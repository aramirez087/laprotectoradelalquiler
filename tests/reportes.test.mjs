import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cargarTS } from './helpers/cedula-mocks.mjs'
import * as periodo from '../lib/periodo.ts'

const plain = value => JSON.parse(JSON.stringify(value))
const util = cargarTS('lib/util.ts')
const cedula = cargarTS('lib/cedula.ts')
const hoy = '2026-10-02'
const fechas = { ...periodo, hoyCR: () => hoy }

function reportes() {
  // Include reviews on both sides of Costa Rica midnight and each calendar boundary.
  const datos = [
    '2025-12-31T23:59:59-06:00', '2026-01-01T00:00:00-06:00',
    '2026-09-27T23:59:59-06:00', '2026-09-28T00:00:00-06:00',
    '2026-09-30T23:59:59-06:00', '2026-10-01T00:00:00-06:00',
    '2026-10-02T00:00:00-06:00', '2026-10-02T23:59:59-06:00',
    '2026-10-03T00:00:00-06:00',
  ].map((creado_en, id) => ({ id: id + 1, creado_en, comentario: `Reseña ${id + 1}`,
    estado: 'publicada', anonima: true, autor: null,
    persona: { id: 1, nombre: 'Ana', apellido1: 'Pérez', identificacion: 'DIMEX12345' },
  }))
  const limites = []
  const db = {
    rpc: async () => ({ data: [], error: null }),
    from: tabla => {
      assert.equal(tabla, 'resenas')
      let inicio = -Infinity, fin = Infinity, offset = 0, ultimo = 19
      const consulta = {
        select: () => consulta, order: () => consulta,
        gte: (campo, fecha) => { assert.equal(campo, 'creado_en'); limites.push(['gte', fecha]); inicio = Date.parse(fecha); return consulta },
        lt: (campo, fecha) => { assert.equal(campo, 'creado_en'); limites.push(['lt', fecha]); fin = Date.parse(fecha); return consulta },
        range: (desde, hasta) => { offset = desde; ultimo = hasta; return consulta },
        then: resolve => {
          const matches = datos.filter(fila => Date.parse(fila.creado_en) >= inicio && Date.parse(fila.creado_en) < fin).reverse()
          return resolve({ data: matches.slice(offset, ultimo + 1), count: matches.length, error: null })
        },
      }
      return consulta
    },
  }
  const admin = cargarTS('lib/admin.ts', {
    'server-only': {}, '@/lib/periodo': fechas, '@/lib/cedula': cedula, '@/lib/util': util,
    '@/lib/acceso-consulta': {}, '@/lib/supabase/admin': { createAdmin: () => db },
    '@/lib/dal': { requerirRol: async () => ({ id: 7 }), historialResenas: async () => [] },
  })
  const mocks = {
    '@/lib/admin': admin, '@/lib/util': util,
    '@/components/admin-ui': cargarTS('components/admin-ui.tsx', { '@/lib/util': util }),
    '@/components/paginacion': cargarTS('components/paginacion.tsx'),
    '@/components/resena-reporte': { ResenaReporte: ({ fila }) => createElement('article', { 'data-resena': fila.id }, fila.comentario) },
    '@/components/filtros-reporte': cargarTS('components/filtros-reporte.tsx', {
      'next/navigation': { useRouter: () => ({ push() {} }) },
      'next/link': { __esModule: true,
        default: ({ children, ...props }) => {
          delete props.scroll
          delete props.onNavigate
          return createElement('a', props, children)
        },
        useLinkStatus: () => ({ pending: false }),
      },
    }),
  }
  const Page = cargarTS('app/admin/reportes/page.tsx', mocks).default
  const { GET } = cargarTS('app/admin/reportes/csv/route.ts', {
    '@/lib/admin': admin, '@/lib/util': util,
    '@/lib/dal': { obtenerUsuario: async () => ({ id: 7, rol: 'admin' }) },
  })
  return { admin, limites, GET, render: async params => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) })) }
}

const links = html => [...html.matchAll(/href="([^"]+)"/g)].map(([, href]) => new URL(href.replaceAll('&amp;', '&'), 'https://example.test'))

test('Costa Rica dates and Monday–Sunday weeks handle midnight, Sundays and year boundaries', () => {
  assert.equal(periodo.hoyCR(new Date('2026-10-03T05:59:59Z')), '2026-10-02')
  assert.equal(periodo.hoyCR(new Date('2026-10-03T06:00:00Z')), '2026-10-03')
  for (const dia of ['2026-09-28', '2026-10-02', '2026-10-04']) {
    assert.deepEqual(periodo.semanaDe(dia), { desde: '2026-09-28', hasta: '2026-10-04' })
  }
  assert.deepEqual(periodo.semanaDe('2026-01-01'), { desde: '2025-12-29', hasta: '2026-01-04' })
  assert.deepEqual(periodo.semanaDe('2026-10-05'), { desde: '2026-10-05', hasta: '2026-10-11' })
})

test('quick periods fetch the selected reviews, reset pagination and carry the same dates into CSV', async () => {
  const h = reportes()
  const initial = await h.render({})
  assert.match(initial, /Hoy/)
  assert.match(initial, /Esta semana/)
  assert.match(initial, /Este mes/)
  assert.match(initial, /Este año/)
  const expectedIds = [[8, 7], [9, 8, 7, 6, 5, 4], [9, 8, 7, 6], [9, 8, 7, 6, 5, 4, 3, 2]]
  const shortcuts = links(initial).filter(url => url.pathname === '/admin/reportes')
  assert.equal(shortcuts.length, 4)
  for (const [index, url] of shortcuts.entries()) {
    assert.equal(url.searchParams.has('pagina'), false)
    const params = Object.fromEntries(url.searchParams)
    const html = await h.render(params)
    assert.deepEqual([...html.matchAll(/data-resena="(\d+)"/g)].map(([, id]) => Number(id)), expectedIds[index])
    assert.match(html, new RegExp(`name="desde"[^>]*value="${params.desde}"`))
    assert.match(html, new RegExp(`name="hasta"[^>]*value="${params.hasta}"`))
    const csv = links(html).find(link => link.pathname === '/admin/reportes/csv')
    assert.equal(csv.search, url.search)
    const response = await h.GET(new Request(csv))
    assert.equal(response.status, 200)
    const exported = await response.text()
    assert.deepEqual([...exported.matchAll(/Reseña (\d+)/g)].map(([, id]) => Number(id)), expectedIds[index])
    const range = periodo.rangoInclusivo(params.desde, params.hasta)
    assert.deepEqual(plain(h.limites.slice(-2)), [['gte', range.inicio], ['lt', range.fin]])
  }
})

test('custom dates normalize reversed bounds and paginate within the selected interval', async () => {
  const h = reportes()
  assert.deepEqual(plain(h.admin.periodoPorDefecto('', 'invalid')), { desde: hoy, hasta: hoy })
  assert.deepEqual(plain(h.admin.periodoPorDefecto('2026-10-03', '2026-09-28')), { desde: '2026-09-28', hasta: '2026-10-03' })
  const result = await h.admin.consultarResenas({ desde: '2026-09-28', hasta: '2026-10-03', pagina: 2, limite: 2, incluirModeracion: false })
  assert.equal(result.total, 6)
  assert.deepEqual(Array.from(result.filas, fila => fila.id), [7, 6])
})

test('custom dates open automatically, empty reports recover, and errors never show a false zero', async () => {
  const h = reportes()
  const preset = await h.render({})
  assert.doesNotMatch(preset, /<details[^>]*open/)
  assert.match(preset, /aria-current="date"/)
  const custom = await h.render({ desde: '2026-08-01', hasta: '2026-08-31' })
  assert.match(custom, /<details[^>]*open=""/)
  assert.match(custom, /Fechas personalizadas/)
  assert.match(custom, /No hay reseñas en estas fechas/)
  assert.match(custom, /href="\/admin\/resenas"/)
  assert.doesNotMatch(custom, /Descargar CSV/)
  h.admin.consultarResenas = async () => { throw new Error('Offline') }
  const failed = await h.render({ desde: '2026-08-01', hasta: '2026-08-31' })
  assert.match(failed, /role="alert"/)
  assert.match(failed, /Volver a intentar/)
  assert.doesNotMatch(failed, /reseñas recibidas|No hay reseñas en estas fechas/)
})

test('compact report cards expose full review controls only inside a named disclosure', () => {
  const { ResenaReporte } = cargarTS('components/resena-reporte.tsx', {
    '@/lib/util': util,
    '@/components/resena-admin': { ResenaAdmin: ({ fila }) => createElement('article', { id: `resena-${fila.id}` }, 'Opciones de moderación') },
  })
  const html = renderToStaticMarkup(createElement(ResenaReporte, { fila: {
    id: 42, creado_en: '2026-10-03T05:30:00Z', comentario: 'Una experiencia positiva.',
    estado: 'borrador', permite_correccion: true, persona: { id: 1, nombre: 'Ana', apellido1: 'Pérez' },
    autor: { nombre: 'Luis Solís' },
  } }))
  assert.match(html, /reporte-resena-42/)
  assert.match(html, /2 oct 2026/)
  assert.match(html, /Corrección solicitada/)
  assert.match(html, /Luis Solís/)
  assert.match(html, /<details[^>]*><summary>.*Ver reseña y opciones.*Ana Pérez, reseña 42.*<\/summary>.*Opciones de moderación/s)
  assert.doesNotMatch(html, /<details[^>]*open/)
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id)
  assert.equal(new Set(ids).size, ids.length)
})
