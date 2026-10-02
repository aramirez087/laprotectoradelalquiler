import { runtimeMocks } from './helpers/runtime-mocks.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'

const require = createRequire(import.meta.url)
const ts = require('typescript')
function action({ activo = true, enRevision = true } = {}) {
  const saved = [], notifications = []
  const mod = { exports: {} }
  const mocks = {
    'next/navigation': { redirect: (path) => { throw new Error(`redirect:${path}`) }, unstable_rethrow: (error) => {
      if (error.message.startsWith('redirect:')) throw error
    } },
    'next/cache': { revalidatePath() {} },
    'next/server': { after: callback => notifications.push(callback) },
    '@/lib/dal': {
      requireUsuario: async () => ({ id: 7, activo }),
      listarResenasDe: async () => [],
      crearResena: async (input) => { saved.push(input); return { personaId: 1, enRevision } },
    },
    '@/lib/util': { esCedulaValida: () => true },
  }
  vm.runInNewContext(ts.transpileModule(readFileSync('lib/actions/resenas.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: mod, exports: mod.exports, require: name => mocks[name] ?? (runtimeMocks[name] ?? require(name)), Error })
  return { submit: mod.exports.crearResenaAction, saved, notifications }
}
function form(fechaInicio) {
  const data = new FormData()
  for (const [key, value] of Object.entries({
    nombre: 'Ana', apellido1: 'Solís', identificacion: '102340567',
    comentario: 'Pagó a tiempo y devolvió la propiedad en buen estado.',
    autorId: '99', estado: 'publicada',
  })) data.set(key, value)
  if (fechaInicio !== undefined) data.set('fechaInicio', fechaInicio)
  return data
}
test('reviews without a rental date reach moderation using the session author', async () => {
  const a = action()
  await assert.rejects(a.submit(undefined, form()), /redirect:\/perfil\?enviada=1/)
  assert.equal(a.saved.length, 1)
  assert.equal(a.saved[0].fechaInicio, undefined)
  assert.equal(a.saved[0].autorId, 7)
  assert.equal(a.saved[0].estado, undefined)
  assert.equal(a.notifications.length, 0)
})
test('a supplied rental date is ignored, including stale forms and forged values', async () => {
  for (const value of ['', '2024-02-29', '2026-09-29', 'not-a-date']) {
    const a = action()
    await assert.rejects(a.submit(undefined, form(value)), /redirect:\/perfil\?enviada=1/)
    assert.equal(a.saved[0].fechaInicio, undefined)
  }
})
test('a confirmed automatic publication redirects to the published tenant ficha', async () => {
  const a = action({ enRevision: false })
  await assert.rejects(a.submit(undefined, form()), /redirect:\/fichas\/1$/)
  assert.equal(a.saved[0].autorId, 7)
  assert.equal(a.saved[0].estado, undefined)
  assert.equal(a.notifications.length, 1)
})
test('review content is still required without a rental date', async () => {
  const a = action()
  const data = form()
  data.set('comentario', 'Too short')
  const result = await a.submit(undefined, data)
  assert.ok(result.campos.comentario)
  assert.equal(result.campos.fechaInicio, undefined)
  assert.equal(a.saved.length, 0)
})
test('inactive accounts cannot submit a rental experience', async () => {
  const a = action({ activo: false })
  assert.match((await a.submit(undefined, form('2024-02-29'))).error, /inactiva/)
  assert.equal(a.saved.length, 0)
})
