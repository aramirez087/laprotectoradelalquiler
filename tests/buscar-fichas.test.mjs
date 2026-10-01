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
      const data = { fichas: filas, total }
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } })
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
      if (nombre === 'buscar_fichas_relevantes') return postgrest.rpc(nombre, parametros)
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

test('search sends a parameterized, account-bound ranked RPC with pagination', async () => {
  const ficha={persona:{id:7,nombre:'Ana',apellido1:'Solís'},resenas:1,ultima:'2026-01-01',coincidencia:'nombre_parcial'}
  const {result, requests}=await buscarConFilas([ficha],{q:'Ana Sol',pagina:2},21)
  assert.equal(requests.length,1)
  const [{request,options}]=requests
  assert.equal(request.pathname,'/rest/v1/rpc/buscar_fichas_relevantes')
  assert.equal(options.method,'POST')
  assert.deepEqual(JSON.parse(options.body),{p_usuario_id:1,p_q:'Ana Sol',p_pagina:2})
  assert.equal(result.total,21)
  assert.equal(result.fichas[0].resenas,1)
  assert.equal(result.fichas[0].coincidencia,'nombre_parcial')
})

test('document formatting normalizes before search while punctuation cannot change PostgREST filters', async () => {
  for(const [q, expected] of [['1-0234-0567','102340567'],['José, Muñoz','José, Muñoz'],['AB-123456','ab123456']]) {
    const {requests}=await buscarConFilas([],{q,pagina:1})
    assert.equal(JSON.parse(requests[0].options.body).p_q,expected)
    assert.equal(requests[0].request.searchParams.size,0)
  }
})

test('invalid and too-short searches never broaden to the whole directory', async () => {
  for(const q of ['J','123','%%___','x'.repeat(151)]) {
    const {result,requests}=await buscarConFilas([],{q})
    assert.equal(result.total,0)
    assert.equal(requests.length,0)
  }
})

test('an out-of-range page preserves the total so the page can redirect safely', async () => {
  const {result}=await buscarConFilas([],{q:'Ana',pagina:5},21)
  assert.equal(result.total,21);assert.equal(result.fichas.length,0)
})
