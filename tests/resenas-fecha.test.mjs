import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import { esFecha } from '../lib/periodo.ts'

const require = createRequire(import.meta.url)
const ts = require('typescript')
function action({ activo = true } = {}) {
  const saved = []
  const mod = { exports: {} }
  const mocks = {
    'next/navigation': { redirect: (path) => { throw new Error(`redirect:${path}`) }, unstable_rethrow: (error) => {
      if (error.message.startsWith('redirect:')) throw error
    } },
    'next/cache': { revalidatePath() {} },
    '@/lib/dal': {
      requireUsuario: async () => ({ id: 7, activo }),
      listarResenasDe: async () => [],
      crearResena: async (input) => { saved.push(input); return { personaId: 1, enRevision: true } },
    },
    '@/lib/util': { esCedulaValida: () => true },
    '@/lib/periodo': { esFecha, hoyCR: () => '2026-09-28' },
  }
  vm.runInNewContext(ts.transpileModule(readFileSync('lib/actions/resenas.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: mod, exports: mod.exports, require: name => mocks[name] ?? require(name), Error })
  return { submit: mod.exports.crearResenaAction, saved }
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
test('missing, impossible and future rental dates are rejected before saving a review', async () => {
  const a = action()
  for (const value of [undefined, '', '2025-02-29', '2026-04-31', '2026-09-29', 'not-a-date']) {
    const result = await a.submit(undefined, form(value))
    assert.ok(result.campos.fechaInicio)
  }
  assert.equal(a.saved.length, 0)
})
test('a valid tenancy date reaches the database using the session author and moderation flow', async () => {
  for (const value of ['2024-02-29', '2026-09-28']) {
    const a = action()
    await assert.rejects(a.submit(undefined, form(value)), /redirect:\/perfil\?enviada=1/)
    assert.equal(a.saved[0].fechaInicio, value)
    assert.equal(a.saved[0].autorId, 7)
    assert.equal(a.saved[0].estado, undefined)
  }
})
test('inactive accounts cannot submit a rental experience', async () => {
  const a = action({ activo: false })
  assert.match((await a.submit(undefined, form('2024-02-29'))).error, /inactiva/)
  assert.equal(a.saved.length, 0)
})
