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
    module: mod, exports: mod.exports, require: name => mocks[name] ?? require(name),
    console, Error, URL, URLSearchParams, Date, process,
  }, { filename: file })
  return mod.exports
}

const util = load('lib/util.ts')
const enlaceFacebook = load('lib/enlace-facebook.ts', { '@/lib/util': util })
const acceso = load('lib/acceso-consulta.ts')
const fixture = [
  { id: 1, nombre: 'Ana', email: 'ana@example.test', activo: true, auth_user_id: 'auth-1' },
  { id: 2, nombre: 'Berta', email: 'berta@example.test', activo: true, auth_user_id: null },
  { id: 3, nombre: 'Carlos', email: 'carlos@example.test', activo: false, auth_user_id: 'auth-3' },
  { id: 4, nombre: 'Diana', email: 'diana@example.test', activo: false, auth_user_id: null },
  { id: 5, nombre: 'Legacy', email: 'autor-5@legacy.laprotec', activo: false, auth_user_id: null },
  { id: 6, nombre: 'Legacy', email: 'AUTOR-6@LEGACY.LAPROTEC', activo: false, auth_user_id: null },
].map(row => ({ rol: 'propietario', identificacion: null, telefono: null, ultimo_acceso: null, creado_en: '2026-01-01', ...row }))

// Use the installed PostgREST builder so assertions inspect real HTTP queries,
// including filter operators, exact counts and ranges sent to the database.
function admin({ rows = fixture, unauthorized = false, failCounts = false, missingCount = false, invalidRange = false } = {}) {
  const requests = []
  const db = new PostgrestClient('http://localhost/rest/v1', {
    fetch: async (url, options) => {
      const request = new URL(url)
      requests.push({ request, options })
      if (request.pathname.endsWith('/autenticaciones')) return Response.json([])
      if (request.pathname.endsWith('/rpc/accesos_consulta')) {
        const ids = JSON.parse(options.body).p_usuario_ids
        return Response.json(ids.filter(id => id !== 3).map(id => ({
          usuario_id: id, puede_consultar: id === 1, aprobadas: 0, pendientes: 0, rechazadas: 0,
          ultima_aprobacion_en: null, vence_en: null, motivo: id === 1 ? 'administracion' : 'ninguna',
        })))
      }
      assert.equal(request.pathname, '/rest/v1/usuarios')
      if (options.method === 'HEAD' && failCounts) return Response.json({ message: 'Count unavailable' }, { status: 400 })
      let found = [...rows]
      const email = request.searchParams.get('email')
      if (email === 'not.ilike.%@legacy.laprotec') found = found.filter(row => !row.email.toLowerCase().endsWith('@legacy.laprotec'))
      if (email === 'ilike.%@legacy.laprotec') found = found.filter(row => row.email.toLowerCase().endsWith('@legacy.laprotec'))
      const active = request.searchParams.get('activo')
      if (active === 'eq.true') found = found.filter(row => row.activo)
      if (active === 'eq.false') found = found.filter(row => !row.activo)
      const role = request.searchParams.get('rol')
      if (role?.startsWith('eq.')) found = found.filter(row => row.rol === role.slice(3))
      const auth = request.searchParams.get('auth_user_id')
      if (auth === 'is.null') found = found.filter(row => row.auth_user_id === null)
      if (auth === 'not.is.null') found = found.filter(row => row.auth_user_id !== null)
      const quoted = request.searchParams.get('or')?.match(/nombre\.imatch\.("(?:\\.|[^"\\])*")/)?.[1]
      const search = quoted ? JSON.parse(quoted).replace(/\\(.)/g, '$1').toLowerCase() : undefined
      if (search) found = found.filter(row => [row.nombre, row.email, row.identificacion, row.telefono].some(value => value?.toLowerCase().includes(search)))
      found.sort((a, b) => a.nombre.localeCompare(b.nombre) || a.id - b.id)
      const total = found.length
      const offset = Number(request.searchParams.get('offset') ?? 0)
      const limit = Number(request.searchParams.get('limit') ?? total)
      if (invalidRange && options.method !== 'HEAD' && offset >= total && offset > 0) {
        return Response.json({ code: 'PGRST103', message: 'Requested range not satisfiable' }, { status: 416, headers: { 'content-range': `*/${total}` } })
      }
      found = found.slice(offset, offset + limit)
      const headers = { 'content-type': 'application/json' }
      if (!(options.method === 'HEAD' && missingCount)) headers['content-range'] = `${offset}-${offset + found.length}/${total}`
      return new Response(options.method === 'HEAD' ? null : JSON.stringify(found), { headers })
    },
  })
  const api = load('lib/admin.ts', {
    'server-only': {},
    '@/lib/supabase/admin': { createAdmin: () => db },
    '@/lib/dal': { requerirRol: async role => { assert.equal(role, 'admin'); if (unauthorized) throw new Error('Unauthorized'); return { id: 99, activo: true } } },
    '@/lib/acceso-consulta': acceso,
    '@/lib/periodo': {},
    '@/lib/util': util,
  })
  return { ...api, requests }
}

const userRequest = h => h.requests.find(({ request, options }) => request.pathname.endsWith('/usuarios') && options.method !== 'HEAD')

test('admin users default to real accounts while counting legacy profiles separately without downloading them', async () => {
  const h = admin()
  const result = await h.buscarUsuarios({})
  assert.deepEqual(Array.from(result.filas, row => row.id), [1, 2, 3, 4])
  assert.equal(result.total, 4)
  assert.deepEqual(JSON.parse(JSON.stringify(result.resumen)), { cuentas: 4, legacy: 2, activas: 2, inactivas: 2, conLogin: 2, sinLogin: 2 })
  const request = userRequest(h)
  assert.equal(request.request.searchParams.get('email'), 'not.ilike.%@legacy.laprotec')
  assert.equal(request.request.searchParams.get('order'), 'nombre.asc,id.asc')
  assert.equal(request.options.headers.prefer, 'count=exact')
  const counts = h.requests.filter(({ options }) => options.method === 'HEAD')
  assert.equal(counts.length, 6)
  for (const { request, options } of counts) {
    assert.equal(request.searchParams.get('select'), 'id')
    assert.equal(options.headers.prefer, 'count=exact')
    assert.equal(request.searchParams.has('limit'), false)
  }
  assert.equal(h.requests.filter(({ request, options }) => request.pathname.endsWith('/usuarios') && options.method !== 'HEAD').length, 1)
})

test('activation, login and legacy filters reach the database before its exact count and pagination', async () => {
  const cases = [
    [{ tipo: 'cuentas', estado: 'activas', login: 'pendiente' }, [2], 'not.ilike.%@legacy.laprotec', 'eq.true', 'is.null'],
    [{ tipo: 'cuentas', estado: 'inactivas', login: 'creado' }, [3], 'not.ilike.%@legacy.laprotec', 'eq.false', 'not.is.null'],
    [{ tipo: 'legacy', estado: 'todos', login: 'todos' }, [5, 6], 'ilike.%@legacy.laprotec', null, null],
    [{ tipo: 'todos', estado: 'todos', login: 'todos' }, [1, 2, 3, 4, 5, 6], null, null, null],
  ]
  for (const [filters, expectedIds, email, active, auth] of cases) {
    const h = admin()
    const result = await h.buscarUsuarios(filters)
    assert.deepEqual(Array.from(result.filas, row => row.id), expectedIds)
    assert.equal(result.total, expectedIds.length)
    const params = userRequest(h).request.searchParams
    assert.equal(params.get('email'), email)
    assert.equal(params.get('activo'), active)
    assert.equal(params.get('auth_user_id'), auth)
    assert.equal(result.resumen.cuentas, 4, 'global counts do not change with the selected view')
  }
})

test('filtered pages have stable name/id ordering, correct totals and enrichment limited to visible rows', async () => {
  const rows = [...fixture, ...Array.from({ length: 25 }, (_, i) => ({ ...fixture[1], id: 100 + i, nombre: 'Nombre repetido', email: `pagina-${i}@example.test` }))]
  const h = admin({ rows })
  const result = await h.buscarUsuarios({ q: 'repetido', pagina: 2, tipo: 'cuentas', estado: 'activas', login: 'pendiente' })
  assert.equal(result.total, 25)
  assert.deepEqual(Array.from(result.filas, row => row.id), [120, 121, 122, 123, 124])
  const params = userRequest(h).request.searchParams
  assert.equal(params.get('offset'), '20')
  assert.equal(params.get('limit'), '20')
  assert.equal(params.get('order'), 'nombre.asc,id.asc')
  assert.match(params.get('or'), /nombre\.imatch/)
  assert.match(params.get('or'), /email\.imatch/)
  assert.equal(result.resumen.cuentas, 29)
  assert.ok(h.requests.filter(({ options }) => options.method === 'HEAD').every(({ request }) => !request.searchParams.has('or')))
  const accessRequest = h.requests.find(({ request }) => request.pathname.endsWith('/rpc/accesos_consulta'))
  assert.deepEqual(JSON.parse(accessRequest.options.body).p_usuario_ids, [120, 121, 122, 123, 124])
})

test('active profile, login provisioning and consultation permission remain separate and auth IDs stay private', async () => {
  const result = await admin().buscarUsuarios({ tipo: 'todos' })
  const byId = new Map(result.filas.map(row => [row.id, row]))
  assert.equal(byId.get(1).activo, true)
  assert.equal(byId.get(1).tieneLogin, true)
  assert.equal(byId.get(1).puedeConsultar, true)
  assert.equal(byId.get(2).activo, true)
  assert.equal(byId.get(2).tieneLogin, false)
  assert.equal(byId.get(2).puedeConsultar, false)
  assert.equal(byId.get(3).activo, false)
  assert.equal(byId.get(3).tieneLogin, true)
  assert.equal(byId.get(3).puedeConsultar, null)
  assert.equal(byId.get(5).esLegacy, true)
  assert.equal(byId.get(6).esLegacy, true, 'legacy classification is case insensitive')
  assert.equal(byId.get(2).esLegacy, false)
  for (const row of result.filas) assert.equal('auth_user_id' in row, false)
})

test('empty pages avoid user enrichment and authorization or count failures cannot become an empty success', async () => {
  const empty = admin()
  const result = await empty.buscarUsuarios({ q: 'No existe' })
  assert.equal(result.filas.length, 0)
  assert.equal(result.total, 0)
  assert.ok(empty.requests.every(({ request }) => request.pathname.endsWith('/usuarios')))
  const denied = admin({ unauthorized: true })
  await assert.rejects(denied.buscarUsuarios({}), /Unauthorized/)
  assert.equal(denied.requests.length, 0)
  await assert.rejects(admin({ failCounts: true }).buscarUsuarios({}))
  await assert.rejects(admin({ missingCount: true }).buscarUsuarios({}))
})

function page({ total = 45, filas = [] } = {}) {
  const calls = []
  const common = {
    'next/link': ({ href, children, ...props }) => createElement('a', { href, ...props }, children),
    '@/lib/util': util,
  }
  const api = load('app/admin/usuarios/page.tsx', {
    ...common,
    'next/navigation': { redirect: href => { const error = new Error('Redirect'); error.href = href; throw error } },
    '@/lib/invitaciones-admin': { listarInvitacionesAdmin: async () => [] },
    '@/components/invitaciones-admin': { InvitacionesAdmin: () => null },
    '@/lib/admin': {
      TAMANO_PAGINA_ADMIN: 20,
      SinClaveAdmin: class extends Error {},
      buscarUsuarios: async opts => {
        calls.push(opts)
        return { total, filas, resumen: { cuentas: 366, legacy: 6055, activas: 283, inactivas: 83, conLogin: 1, sinLogin: 365 } }
      },
    },
    '@/lib/correo-resenas': { correoResenasConfigurado: () => false },
    '@/components/admin-ui': load('components/admin-ui.tsx', common),
    '@/components/paginacion': load('components/paginacion.tsx', common),
    '@/components/perfil-facebook': load('components/perfil-facebook.tsx', { '@/lib/enlace-facebook': enlaceFacebook }),
    '@/components/form-invitacion-admin': { FormInvitacionAdmin: () => null },
    '@/components/admin-formularios': { FormUsuario: () => null },
  })
  return { render: async params => renderToStaticMarkup(await api.default({ searchParams: Promise.resolve(params) })), calls }
}

function links(html) {
  return [...html.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1].replaceAll('&amp;', '&'), 'http://localhost'))
}

test('admin users page defaults to real accounts and normalizes unsupported filters', async () => {
  for (const params of [{}, { tipo: 'unknown', estado: 'unknown', login: 'unknown' }]) {
    const h = page()
    await h.render(params)
    assert.equal(h.calls[0].tipo, 'cuentas')
    assert.equal(h.calls[0].estado, 'todos')
    assert.equal(h.calls[0].login, 'todos')
  }
})

test('admin users pagination and clearing search retain every selected account filter', async () => {
  const h = page()
  const html = await h.render({ q: 'Ana & María', tipo: 'todos', estado: 'activas', login: 'pendiente', pagina: '2' })
  const destinations = links(html).filter(url => url.pathname === '/admin/usuarios')
  const next = destinations.find(url => url.searchParams.get('pagina') === '3')
  assert.ok(next)
  assert.equal(next.searchParams.get('q'), 'Ana & María')
  for (const key of ['tipo', 'estado', 'login']) assert.equal(next.searchParams.get(key), h.calls[0][key])
  const cleared = destinations.find(url => !url.searchParams.has('q') && url.searchParams.get('estado') === 'activas' && url.searchParams.get('login') === 'pendiente')
  assert.ok(cleared, 'clear-search link keeps the active view')
  assert.equal(cleared.searchParams.get('tipo'), 'todos')
  assert.equal(cleared.searchParams.has('pagina'), false, 'clearing search restarts from page one')
})

test('out-of-range page redirects retain the search and selected account filters', async () => {
  const h = page({ total: 25 })
  await assert.rejects(h.render({ q: 'Ana', tipo: 'legacy', estado: 'inactivas', login: 'creado', pagina: '9' }), error => {
    const url = new URL(error.href, 'http://localhost')
    assert.equal(url.pathname, '/admin/usuarios')
    assert.equal(url.searchParams.get('pagina'), '2')
    assert.equal(url.searchParams.get('q'), 'Ana')
    assert.equal(url.searchParams.get('tipo'), 'legacy')
    assert.equal(url.searchParams.get('estado'), 'inactivas')
    assert.equal(url.searchParams.get('login'), 'creado')
    return true
  })
})

test('admin user cards distinguish account activation from login and consultation eligibility', async () => {
  const filas = [
    { ...fixture[1], tieneLogin: false, esLegacy: false, puedeConsultar: false, registro: 'Esperando su primera reseña.' },
    { ...fixture[2], tieneLogin: true, esLegacy: false, puedeConsultar: null, registro: 'Permiso por verificar.' },
    { ...fixture[4], tieneLogin: false, esLegacy: true, puedeConsultar: false, registro: 'Autor conservado del sistema anterior.' },
  ]
  const html = await page({ total: 3, filas }).render({ tipo: 'todos' })
  const cards = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(match => match[1])
  assert.equal(cards.length, 3)
  const valueAfter = (card, label) => card.match(new RegExp(`${label}</dt>\\s*<dd><span[^>]*>([^<]+)</span></dd>`))?.[1]
  assert.equal(valueAfter(cards[0], 'Estado de la cuenta'), 'Activa')
  assert.equal(valueAfter(cards[0], 'Inicio de sesión'), 'Sin crear')
  assert.equal(valueAfter(cards[0], 'Permiso para consultar fichas'), 'No habilitado')
  assert.equal(valueAfter(cards[1], 'Estado de la cuenta'), 'Inactiva')
  assert.equal(valueAfter(cards[1], 'Inicio de sesión'), 'Creado')
  assert.equal(valueAfter(cards[1], 'Permiso para consultar fichas'), 'Por verificar')
  assert.equal(valueAfter(cards[2], 'Inicio de sesión'), 'No corresponde')
})

test('admin user cards display supplied Facebook names and preserve shared profile links', async () => {
  const compartido = 'https://www.facebook.com/share/1Example/?mibextid=wwXIfr'
  const filas = [
    { ...fixture[0], tieneLogin: true, facebook: 'María Solís' },
    { ...fixture[1], tieneLogin: true, facebook: compartido },
  ]
  const html = await page({ total: 2, filas }).render({})
  assert.match(html, /Facebook: María Solís/)
  assert.ok(!links(html).some(url => url.href.includes('Mar%C3%ADa')))
  assert.ok(links(html).some(url => url.href === compartido))
})

test('literal email punctuation, quotes and single-character searches are applied', async () => {
  const rows = [
    { ...fixture[0], email: 'ana_maria@example.test' },
    { ...fixture[1], nombre: 'Un 5% literal ("nuevo") * [a-z] \\' },
  ]
  for (const [q, expected] of [['ana_maria@example.test', [1]], ['5%', [2]], ['("nuevo")', [2]], ['*', [2]], ['[a-z]', [2]], ['\\', [2]], ['B', [2]]]) {
    const h = admin({ rows })
    assert.deepEqual(Array.from((await h.buscarUsuarios({ q })).filas, row => row.id), expected)
    assert.ok(userRequest(h).request.searchParams.has('or'))
  }
})

test('role filtering and range-error recovery preserve the full filtered count', async () => {
  const rows = [...fixture, { ...fixture[0], id: 7, rol: 'admin' }]
  const h = admin({ rows, invalidRange: true })
  const result = await h.buscarUsuarios({ pagina: 9, tipo: 'cuentas', estado: 'activas', login: 'creado', rol: 'admin' })
  assert.equal(result.total, 1)
  assert.equal(result.filas.length, 0, 'the page can redirect before enriching an invalid range')
  const recovery = h.requests.find(({ request, options }) => options.method === 'HEAD' && request.searchParams.get('rol') === 'eq.admin')
  assert.ok(recovery)
  assert.equal(recovery.request.searchParams.get('activo'), 'eq.true')
  assert.equal(recovery.request.searchParams.get('auth_user_id'), 'not.is.null')
  assert.equal(recovery.request.searchParams.has('offset'), false)
  assert.equal(recovery.request.searchParams.has('limit'), false)
})
