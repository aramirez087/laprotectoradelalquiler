import { runtimeMocks } from './helpers/runtime-mocks.mjs'
import { mocksCedula } from './helpers/cedula-mocks.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const { PostgrestClient } = require('@supabase/postgrest-js')

async function buscarConFilas(filas, opts = { pagina: 1 }, total = filas.length) {
  const requests = []
  const postgrest = new PostgrestClient('http://localhost/rest/v1', {
    fetch: async (url, options) => {
      const request = new URL(url)
      requests.push({ request, options })
      const isSearch = request.pathname.endsWith('/personas')
      const validFilter = request.searchParams.get('select')?.includes('resenas!inner(')
        && request.searchParams.get('resenas.estado') === 'eq.publicada'
      const data = isSearch && validFilter
        ? filas
        : []
      return new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json', 'content-range': `0-${data.length ? data.length - 1 : 0}/${isSearch && validFilter ? total : 0}` },
      })
    },
  })
  const db = {
    from: (table) => table === 'usuarios'
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 1, rol: 'admin', activo: true }, error: null }) }) }) }
      : postgrest.from(table),
    rpc: async (nombre, parametros) => {
      if (nombre === 'sesion_administracion_vigente') {
        assert.equal(parametros.p_auth_user_id, 'auth-id')
        assert.equal(parametros.p_session_id, '11111111-1111-4111-8111-111111111111')
        return { data: true, error: null }
      }
      return { data: [{ puede_consultar: true, usuario_id: 1 }], error: null }
    },
    auth: {
      getUser: async () => ({ data: { user: { id: 'auth-id' } } }),
      getClaims: async () => ({ data: { claims: { sub: 'auth-id', session_id: '11111111-1111-4111-8111-111111111111' } }, error: null }),
    },
  }
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync('lib/dal.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: mod, exports: mod.exports, require: (name) => mocksCedula[name] ?? ({
      'server-only': {}, react: { cache: (fn) => fn }, 'next/navigation': {},
      '@/lib/facebook-alta': {}, '@/lib/facebook-auth': { cuentaCreadaConFacebook: () => false },
      '@/lib/util': { palabrasBusqueda: () => [], variantesAcento: (v) => [v] },
      '@/lib/supabase/admin': { createAdmin: () => db },
      '@/lib/supabase/server': { createClient: async () => db, sinSupabase: () => false },
    })[name] ?? (runtimeMocks[name] ?? require(name)), console, Error, URL, Date,
  })

  return { result: await mod.exports.buscarFichas(opts), requests }
}

test('search excludes fichas without published reviews before counting and paginating', async () => {
  const { result, requests } = await buscarConFilas([
    { id: 7, nombre: 'Ana', apellido1: 'Solís', provincia_id: null, provincia: null,
      resenas: [{ id: 8, estado: 'publicada', creado_en: '2026-01-01' }] },
  ], { pagina: 2 }, 21)
  const search = requests.find(({ request }) => request.pathname.endsWith('/personas'))
  assert.ok(search)
  assert.match(search.request.searchParams.get('select'), /resenas!inner\(/)
  assert.equal(search.request.searchParams.get('resenas.estado'), 'eq.publicada')
  assert.equal(search.request.searchParams.get('offset'), '20')
  assert.equal(search.request.searchParams.get('limit'), '20')
  assert.equal(search.options.headers.prefer, 'count=exact')
  assert.equal(result.total, 21)
  assert.equal(result.fichas[0].resenas, 1)
})

test('search uses review counts and latest publication without rating or catalog lookups', async () => {
  const { result, requests } = await buscarConFilas([
    { id: 7, nombre: 'Ana', apellido1: 'Solís', provincia_id: 1, provincia: { nombre: 'San José' },
      resenas: [
        { id: 8, estado: 'publicada', calificacion_id: 1, calificacion: { valor: 5 }, creado_en: '2026-09-20T12:00:00Z' },
        { id: 9, estado: 'publicada', calificacion_id: null, calificacion: null, creado_en: '2026-01-01T12:00:00Z' },
        { id: 10, estado: 'borrador', calificacion_id: 2, calificacion: { valor: 1 }, creado_en: '2026-09-29T12:00:00Z' },
      ] },
    { id: 11, nombre: 'María', apellido1: 'Pérez', provincia_id: null, provincia: null,
      resenas: [{ id: 12, estado: 'publicada', creado_en: '2026-05-15T12:00:00Z' }] },
  ])

  assert.equal(requests.length, 1, 'search must not load historical form catalogs')
  const [{ request }] = requests
  assert.equal(request.pathname, '/rest/v1/personas')
  assert.doesNotMatch(request.searchParams.get('select'), /calificacion|provincia|\*/)
  assert.equal(result.total, 2)
  assert.equal(result.fichas[0].resenas, 2)
  assert.equal(result.fichas[0].ultima, '2026-09-20T12:00:00Z')
  assert.equal(result.fichas[1].resenas, 1)
  assert.ok(result.fichas.every((ficha) => !Object.hasOwn(ficha, 'promedio') && !Object.hasOwn(ficha, 'provincia')))
})
