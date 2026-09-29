import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const { PostgrestClient } = require('@supabase/postgrest-js')

test('search excludes fichas without published reviews before counting and paginating', async () => {
  const requests = []
  const postgrest = new PostgrestClient('http://localhost/rest/v1', {
    fetch: async (url, options) => {
      const request = new URL(url)
      requests.push({ request, options })
      const isSearch = request.pathname.endsWith('/personas')
      const validFilter = request.searchParams.get('select')?.includes('resenas!inner(')
        && request.searchParams.get('resenas.estado') === 'eq.publicada'
      const data = isSearch && validFilter
        ? [{ id: 7, nombre: 'Ana', apellido1: 'Solís', provincia_id: null, provincia: null,
          resenas: [{ id: 8, estado: 'publicada', calificacion_id: 1, calificacion: { valor: 5 }, creado_en: '2026-01-01' }] }]
        : []
      return new Response(JSON.stringify(data), {
        headers: { 'content-type': 'application/json', 'content-range': `0-${data.length ? data.length - 1 : 0}/${data.length}` },
      })
    },
  })
  const db = {
    from: (table) => table === 'usuarios'
      ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 1, rol: 'admin', activo: true }, error: null }) }) }) }
      : postgrest.from(table),
    rpc: async () => ({ data: [{ puede_consultar: true, usuario_id: 1 }], error: null }),
    auth: { getUser: async () => ({ data: { user: { id: 'auth-id' } } }) },
  }
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync('lib/dal.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: mod, exports: mod.exports, require: (name) => ({
      'server-only': {}, react: { cache: (fn) => fn }, 'next/navigation': {},
      '@/lib/facebook-alta': {}, '@/lib/facebook-auth': { cuentaCreadaConFacebook: () => false },
      '@/lib/util': { palabrasBusqueda: () => [], variantesAcento: (v) => [v] },
      '@/lib/supabase/admin': { createAdmin: () => db },
      '@/lib/supabase/server': { createClient: async () => db, sinSupabase: () => false },
    })[name] ?? require(name), console, Error, URL, Date,
  })

  const result = await mod.exports.buscarFichas({ pagina: 1 })
  const search = requests.find(({ request }) => request.pathname.endsWith('/personas'))
  assert.ok(search)
  assert.match(search.request.searchParams.get('select'), /resenas!inner\(/)
  assert.equal(search.request.searchParams.get('resenas.estado'), 'eq.publicada')
  assert.equal(search.request.searchParams.get('offset'), '0')
  assert.equal(search.options.headers.prefer, 'count=exact')
  assert.equal(result.total, 1)
  assert.equal(result.fichas[0].resenas, 1)
})
