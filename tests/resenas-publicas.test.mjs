import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const codigo = ts.transpileModule(readFileSync('lib/dal.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function cargarConteo(createAdmin) {
  const modulo = { exports: {} }
  vm.runInNewContext(codigo, {
    module: modulo,
    exports: modulo.exports,
    require: nombre => {
      if (nombre === '@/lib/supabase/admin') return { createAdmin }
      if (nombre === 'server-only' || nombre.startsWith('@/')) return {}
      return require(nombre)
    },
  })
  return modulo.exports.contarResenasPublicadas
}

function clienteConRespuesta(fetch) {
  return createClient('https://proyecto.example', 'clave-solo-para-pruebas', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  })
}

test('public review count only requests the aggregate for published reviews without downloading rows', async () => {
  const cliente = clienteConRespuesta(async (entrada, opciones) => {
    const url = new URL(entrada)
    assert.equal(url.pathname, '/rest/v1/resenas')
    assert.equal(url.searchParams.get('estado'), 'eq.publicada')
    assert.equal(url.searchParams.get('select'), 'id')
    assert.equal(opciones.method, 'HEAD')
    assert.equal(new Headers(opciones.headers).get('Prefer'), 'count=exact')
    return new Response(null, { headers: { 'Content-Range': '0-0/1234' } })
  })
  assert.equal(await cargarConteo(() => cliente)(), 1234)
})

test('zero published reviews remains distinct from an unavailable count', async () => {
  for (const [headers, esperado] of [[{ 'Content-Range': '*/0' }, 0], [{}, null]]) {
    const cliente = clienteConRespuesta(async () => new Response(null, { headers }))
    assert.equal(await cargarConteo(() => cliente)(), esperado)
  }
})

test('database errors do not become a misleading zero or break the public landing', async () => {
  const cliente = clienteConRespuesta(async () => new Response(null, { status: 403 }))
  assert.equal(await cargarConteo(() => cliente)(), null)
})

test('missing or invalid server configuration omits the public count', async () => {
  assert.equal(await cargarConteo(() => null)(), null)
  assert.equal(await cargarConteo(() => { throw new Error('Configuración inválida') })(), null)
})
