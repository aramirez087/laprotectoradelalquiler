import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import {
  paginaAudiencia, fuenteAudiencia, dispositivoAudiencia, eventosAudiencia, eventoPublicoAudiencia,
  fechasAudiencia, periodoAudiencia, resumirAudiencia,
} from '../lib/audiencia.ts'

test('audience categorizes allowed pages without exporting document IDs, queries or access tokens', () => {
  assert.equal(paginaAudiencia('/fichas/123456789'), 'ficha')
  assert.equal(paginaAudiencia('/ejemplo'), 'ejemplo')
  assert.equal(paginaAudiencia('/guias'), 'guias')
  assert.equal(paginaAudiencia('/guias/referencias-de-inquilinos'), 'guia_referencias')
  assert.equal(paginaAudiencia('/guias/preguntas-para-arrendadores'), 'guia_preguntas')
  assert.equal(paginaAudiencia('/guias/como-escribir-una-resena'), 'guia_resena')
  assert.equal(paginaAudiencia('/guias/desconocida'), null)
  for (const path of ['/admin', '/admin/estadisticas', '/auth/confirmar', '/recuperar', '/restablecer', '/invitacion/admin', '/fichas/123?cedula=123456789', '/unknown']) {
    assert.equal(paginaAudiencia(path), null)
  }
  assert.deepEqual(eventosAudiencia('ficha', 'movil', 'facebook'), [
    'site_page_view', 'site_page_ficha', 'site_device_movil', 'site_session_start', 'site_source_facebook',
  ])
  assert.equal(eventosAudiencia('inicio', 'computadora', null).length, 3)
})

test('public events admit only fixed names on their matching route and trigger', () => {
  assert.equal(eventoPublicoAudiencia('inicio_ejemplo', '/', 'clic'), 'site_public_inicio_ejemplo')
  for (const evento of ['ejemplo_con_resenas', 'ejemplo_sin_resultados', 'ejemplo_registro']) {
    assert.equal(eventoPublicoAudiencia(evento, '/ejemplo', 'clic'), `site_public_${evento}`)
    assert.equal(eventoPublicoAudiencia(evento, '/', 'clic'), null)
    assert.equal(eventoPublicoAudiencia(evento, '/ejemplo', 'visita'), null)
  }
  assert.equal(eventoPublicoAudiencia('registro_desde_ejemplo', '/registro', 'visita'), 'site_public_registro_desde_ejemplo')
  assert.equal(eventoPublicoAudiencia('registro_desde_ejemplo', '/registro', 'clic'), null)
  for (const [evento, ruta] of [
    ['guia_referencias_registro', '/guias/referencias-de-inquilinos'],
    ['guia_preguntas_registro', '/guias/preguntas-para-arrendadores'],
    ['guia_resena_registro', '/guias/como-escribir-una-resena'],
  ]) {
    assert.equal(eventoPublicoAudiencia(evento, ruta, 'clic'), `site_public_${evento}`)
    assert.equal(eventoPublicoAudiencia(evento, '/guias', 'clic'), null)
    assert.equal(eventoPublicoAudiencia(evento, ruta, 'visita'), null)
  }
  for (const valor of [null, '', '__proto__', 'constructor', 'private@example.test', '/fichas/123', 'ejemplo_registro?cedula=123']) {
    assert.equal(eventoPublicoAudiencia(valor, '/ejemplo', 'clic'), null)
  }
})

test('referrers collapse to fixed categories, including misleading hostnames and private query strings', () => {
  const own = 'https://protectoradelalquiler.com'
  assert.equal(fuenteAudiencia(`${own}/fichas?q=123456789`, own), 'directo')
  assert.equal(fuenteAudiencia('https://www.google.co.cr/search?q=private', own), 'google')
  assert.equal(fuenteAudiencia('https://l.facebook.com/l.php?u=private', own), 'facebook')
  assert.equal(fuenteAudiencia('https://facebook.com.attacker.test/', own), 'otros')
  assert.equal(fuenteAudiencia('https://another.test/private-path?token=private', own), 'otros')
  assert.equal(fuenteAudiencia('', own), 'directo')
  assert.equal(dispositivoAudiencia('Mozilla Android Mobile'), 'movil')
  assert.equal(dispositivoAudiencia('Mozilla iPad'), 'tableta')
})

test('report windows contain exactly 7 or 28 closed Statsig days at the Costa Rica 02:00 boundary', () => {
  assert.equal(periodoAudiencia('anything'), 7)
  assert.equal(periodoAudiencia('28'), 28)
  const before = fechasAudiencia(7, new Date('2026-10-01T07:59:59Z'))
  const after = fechasAudiencia(7, new Date('2026-10-01T08:00:00Z'))
  assert.equal(before.at(-1), '2026-09-29')
  assert.equal(after.at(-1), '2026-09-30')
  assert.equal(after[0], '2026-09-24')
  assert.equal(fechasAudiencia(28, new Date('2026-03-01T08:00:00Z'))[0], '2026-02-01')
})

const value = (metricName, value, unitType = 'userID', metricType = 'event_count') => ({ metricName, value, unitType, metricType })
test('unique visitors use the rolling unique metric, not the sum of daily visitors or unit types', () => {
  const dates = fechasAudiencia(7, new Date('2026-10-01T08:00:00Z'))
  const days = dates.map(fecha => ({ fecha, valores: [
    value('site_page_view', 10, 'overall'), value('site_page_view', 10),
    value('site_session_start', 5), value('site_page_inicio', 6), value('site_source_google', 2),
    value('dau', 3, 'userID', 'user'),
    value('wau', 8, 'userID', 'user'),
    value('new_wau', 2, 'userID', 'user'),
  ] }))
  const summary = resumirAudiencia(days, 7)
  assert.equal(summary.visitantes, 8)
  assert.deepEqual(summary.serie.map(d => d.visitantes), Array(7).fill(3))
  assert.equal(summary.nuevos, 2)
  assert.equal(summary.vistas, 70)
  assert.equal(summary.sesiones, 35)
  assert.equal(summary.completo, true)
  assert.deepEqual(summary.paginas, [{ etiqueta: 'Inicio', cantidad: 42 }])
  assert.deepEqual(summary.fuentes, [{ etiqueta: 'Google', cantidad: 14 }])
  const incomplete = resumirAudiencia([...days.slice(0, 6), {fecha: dates[6], valores: null}], 7)
  assert.equal(incomplete.visitantes, null)
  assert.equal(incomplete.vistas, 60)
  assert.equal(incomplete.completo, false)
  assert.equal(incomplete.serie.at(-1).vistas, null)
})

test('Console API user metrics distinguish daily, weekly and 28-day unique browser counts', () => {
  // Use the Console API row shape; Stable IDs are disabled in the SDK.
  const days = [
    {fecha: '2026-09-30', valores: [
      value('site_page_view', 33, 'overall'), value('dau', 7, 'userID', 'user'),
    ]},
    {fecha: '2026-10-01', valores: [
      value('site_page_view', 116, 'overall'),
      value('dau', 0, 'stableID', 'user'), value('dau', 54, 'userID', 'user'),
      value('wau', 0, 'stableID', 'user'), value('wau', 60, 'userID', 'user'),
      value('mau_28d', 75, 'userID', 'user'),
      value('new_wau', 53, 'userID', 'user'), value('new_mau_28d', 68, 'userID', 'user'),
    ]},
  ]
  const weekly = resumirAudiencia(days, 7)
  assert.equal(weekly.visitantes, 60)
  assert.equal(weekly.nuevos, 53)
  assert.equal(weekly.vistas, 149)
  assert.deepEqual(weekly.serie.map(d => d.visitantes), [7, 54])
  const monthly = resumirAudiencia(days, 28)
  assert.equal(monthly.visitantes, 75)
  assert.equal(monthly.nuevos, 68)
})

test('user reports preserve missing data and explicit zeros and ignore unrelated metric types', () => {
  const summary = resumirAudiencia([
    {fecha: '2026-09-29', valores: null},
    {fecha: '2026-09-30', valores: [value('site_page_view', 10), value('dau', 10)]},
    {fecha: '2026-10-01', valores: [
      value('site_page_view', 0), value('dau', 0, 'userID', 'user'),
      value('wau', 12), value('wau', 0, 'userID', 'user'),
      value('new_wau', 0, 'userID', 'user'),
    ]},
  ], 7)
  assert.deepEqual(summary.serie.map(d => d.visitantes), [null, null, 0])
  assert.equal(summary.visitantes, 0)
  assert.equal(summary.nuevos, 0)
  assert.equal(resumirAudiencia([{fecha: '2026-10-01', valores: [value('wau', 12)]}], 7).visitantes, null)
})

test('empty and unavailable reports remain pending instead of inventing zero visits', () => {
  const summary = resumirAudiencia([{fecha: '2026-09-30', valores: []}], 7)
  assert.equal(summary.disponible, false)
  assert.equal(summary.vistas, null)
  assert.equal(summary.visitantes, null)
  const zero = resumirAudiencia([{fecha: '2026-09-30', valores: [value('site_page_view', 0)]}], 7)
  assert.equal(zero.disponible, true)
  assert.equal(zero.vistas, 0)
})

test('new example metrics retain missing days and explicit zeros separately from existing traffic', () => {
  const summary = resumirAudiencia([
    {fecha: '2026-09-28', valores: [value('site_page_view', 20)]},
    {fecha: '2026-09-29', valores: [value('site_page_view', 10), value('site_page_ejemplo', 3, 'overall'), value('site_page_ejemplo', 3)]},
    {fecha: '2026-09-30', valores: [value('site_page_view', 10), value('site_page_ejemplo', 0), value('site_public_ejemplo_registro', 0)]},
  ], 7)
  assert.deepEqual(summary.ejemplo[0], {etiqueta: 'Visitas a la consulta de ejemplo', cantidad: 3, diasDisponibles: 2})
  assert.equal(summary.ejemplo[1].cantidad, null)
  assert.equal(summary.ejemplo[1].diasDisponibles, 0)
  assert.equal(summary.ejemplo[4].cantidad, 0)
  assert.equal(summary.ejemplo[4].diasDisponibles, 1)
  assert.equal(summary.ejemplo[5].cantidad, null)
})

const require = createRequire(import.meta.url)
const ts = require('typescript')
function reporting({unauthorized = false, failure = false, configured = true} = {}) {
  const calls = []
  const reportingModule = {exports: {}}
  const code = ts.transpileModule(readFileSync('lib/estadisticas.ts','utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText
  vm.runInNewContext(code, {
    module: reportingModule, exports: reportingModule.exports, URLSearchParams, AbortSignal, Error,
    process: {env: configured ? {STATSIG_CONSOLE_API_KEY: 'private-test-key', NEXT_PUBLIC_STATSIG_CLIENT_KEY: 'public-test-key'} : {}},
    require: name => ({
      'server-only': {}, '@/lib/registro-error': {registrarError() {}},
      '@/lib/dal': {async requerirRol(role) { assert.equal(role, 'admin'); if (unauthorized) throw new Error('Unauthorized') }},
      '@/lib/audiencia': {fechasAudiencia, resumirAudiencia},
    }[name] ?? require(name)),
    fetch: async (url, options) => {
      const request = new URL(url)
      calls.push({request, options})
      if (failure) return Response.json({}, {status: 503})
      const page = request.searchParams.get('page')
      return Response.json({data: page === '1' ? [value('site_page_view', 4)] : [value('site_page_inicio', 4)],
        pagination: {nextPage: page === '1' ? '/page2' : null}})
    },
  })
  return {api: reportingModule.exports, calls}
}

test('reports authorize admin before making any external request or reading metrics', async () => {
  const h = reporting({unauthorized: true})
  await assert.rejects(h.api.estadisticasAdmin(7), /Unauthorized/)
  assert.equal(h.calls.length, 0)
})

test('real reporting request shape uses server headers, pagination and no secret in the URL or result', async () => {
  const h = reporting()
  const result = await h.api.estadisticasAdmin(7)
  assert.equal(h.calls.length, 14)
  assert.equal(result.vistas, 28)
  assert.equal(result.paginas[0].cantidad, 28)
  for (const {request, options} of h.calls) {
    assert.equal(request.origin, 'https://statsigapi.net')
    assert.equal(options.headers['STATSIG-API-KEY'], 'private-test-key')
    assert.equal(request.href.includes('private-test-key'), false)
    assert.equal(options.next.revalidate, 900)
  }
  assert.equal(JSON.stringify(result).includes('private-test-key'), false)
})

test('missing settings and provider failures remain distinguishable from zero traffic', async () => {
  const missing = reporting({configured: false})
  assert.equal((await missing.api.estadisticasAdmin(7)).configurado, false)
  assert.equal(missing.calls.length, 0)
  const failing = await reporting({failure:true}).api.estadisticasAdmin(7)
  assert.equal(failing.errores, 7)
  assert.equal(failing.vistas, null)
})

function component(path, overrides = {}) {
  const compiled = {exports: {}}
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
  }).outputText
  vm.runInNewContext(code, {
    module: compiled, exports: compiled.exports, Intl, Date,
    require: name => overrides[name] ?? (name === '@/lib/util' ? {
      formatoNumero: n => String(n), primer: v => Array.isArray(v) ? v[0] ?? '' : v ?? '',
    } : require(name)),
  })
  return compiled.exports
}

const React = require('react')
const {renderToStaticMarkup} = require('react-dom/server')
const {GraficoAudiencia} = component('components/grafico-audiencia.tsx')

test('traffic chart breaks both lines across missing reports and exposes an accessible daily table', () => {
  const serie = [
    {fecha: '2026-09-27', vistas: 10, visitantes: 5},
    {fecha: '2026-09-28', vistas: 20, visitantes: 8},
    {fecha: '2026-09-29', vistas: null, visitantes: null},
    {fecha: '2026-09-30', vistas: 0, visitantes: 0},
  ]
  const html = renderToStaticMarkup(React.createElement(GraficoAudiencia, {serie}))
  assert.equal((html.match(/<polyline /g) ?? []).length, 4)
  assert.equal((html.match(/<circle /g) ?? []).length, 2)
  assert.match(html, /tabindex="0" role="group" aria-label="Explorar tráfico por día"/)
  assert.match(html, /scope="col"/)
  assert.match(html, /scope="row"/)
  assert.match(html, /Pendiente/)
  assert.doesNotMatch(html, /NaN|Infinity/)
})

test('empty traffic chart is honest about pending data and never renders a fabricated line', () => {
  const html = renderToStaticMarkup(React.createElement(GraficoAudiencia, {
    serie: [{fecha: '2026-09-30', vistas: null, visitantes: null}],
  }))
  assert.match(html, /Aquí verá cómo crece la audiencia/)
  assert.doesNotMatch(html, /<svg/)
  assert.match(html, /Pendiente/)
})

test('Administración contains an active Estadísticas link', () => {
  const Link = ({children, ...props}) => React.createElement('a', props, children)
  const {NavAdmin} = component('components/nav-admin.tsx', {
    '@/components/enlace': {default: Link},
    'next/navigation': {usePathname: () => '/admin/estadisticas'},
  })
  const html = renderToStaticMarkup(React.createElement(NavAdmin))
  assert.match(html, /href="\/admin\/estadisticas" aria-current="page"[^>]*>Estadísticas<\/a>/)
})
