import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'

const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks) {
  const mod = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: (name) => mocks[name] ?? require(name), console, Error })
  return mod.exports
}

function admin({ rol = 'admin', activo = true, error = null } = {}) {
  const calls = []
  const api = load('lib/admin.ts', {
    'server-only': {},
    '@/lib/dal': { requerirRol: async (expected) => {
      assert.equal(expected, 'admin')
      if (rol !== expected || !activo) throw new Error('Unauthorized')
      return { id: 7, rol, activo }
    } },
    '@/lib/supabase/admin': { createAdmin: () => ({ rpc: (name, params) => {
      calls.push({ name, params })
      return { single: async () => ({ error, data: error ? null : { persona_id: 4, persona_anterior_id: 2, movida: true, autor_email: 'author@example.test', autor_nombre: 'Author' } }) }
    } }) },
    '@/lib/periodo': {},
    '@/lib/acceso-consulta': {},
    '@/lib/util': { normalizarCedula: (s) => s.trim().replace(/\s+/g, '') },
  })
  return { ...api, calls }
}
const input = { id: 1, identificacion: 'LEGACY-42', nombre: 'Ana', nombre2: '', apellido1: 'Solís', apellido2: '', comentario: 'Updated', anonima: true }

test('edit and delete require an active admin before database access', async () => {
  for (const config of [{ rol: 'propietario' }, { rol: 'inquilino' }, { activo: false }]) {
    const a = admin(config)
    await assert.rejects(a.editarResena(input), /Unauthorized/)
    await assert.rejects(a.eliminarResena(1), /Unauthorized/)
    assert.equal(a.calls.length, 0)
  }
})
test('each mutation makes one atomic RPC with the session admin and returns the stored author', async () => {
  const a = admin()
  const edited = await a.editarResena({ ...input, adminId: 99, email: 'forged@example.test' })
  assert.equal(a.calls.length, 1)
  assert.equal(a.calls[0].name, 'admin_editar_resena')
  assert.equal(a.calls[0].params.p_admin_id, 7)
  assert.equal(a.calls[0].params.p_identificacion, 'LEGACY-42')
  assert.equal(edited.autor.email, 'author@example.test')
  const deleted = await a.eliminarResena(1)
  assert.equal(a.calls[1].name, 'admin_eliminar_resena')
  assert.equal(deleted.autor.email, 'author@example.test')
})
test('expected database validation becomes a useful admin error', async () => {
  const message = 'Escriba un documento de 6 a 12 dígitos; puede incluir guiones.'
  const a = admin({ error: { code: 'P0001', message } })
  await assert.rejects(a.editarResena(input), (error) => error instanceof a.AvisoAdmin && error.message === message)
})
test('moving a review cannot give its author a second review of the target tenant', async () => {
  const a = admin({ error: { code: '23505', message: 'duplicate key violates unique constraint "resenas_autor_persona_unica"' } })
  await assert.rejects(a.editarResena(input), (error) => error instanceof a.AvisoAdmin && /propietario ya tiene una reseña/.test(error.message))
})

function actions(config = {}, correo = {}) {
  const backend = admin(config)
  const notifications = [], revalidations = []
  const api = load('lib/actions/admin.ts', {
    '@/lib/admin': backend,
    '@/lib/correo-resenas': { notificarCambioResena: async (input) => {
      notifications.push(input)
      return input.solicitada ? correo : {}
    } },
    'next/cache': { revalidatePath: (path) => revalidations.push(path) },
    'next/navigation': { unstable_rethrow() {} },
  })
  return { ...api, backend, notifications, revalidations }
}
function form(notify = false) {
  const f = new FormData()
  for (const [key, value] of Object.entries({ ...input, confirmar: '1', email: 'forged@example.test', adminId: '99' })) f.set(key, String(value))
  if (notify) f.set('notificar', '1')
  return f
}

test('edit/delete notification follows a successful mutation and uses its stored author', async () => {
  const a = actions({}, { mensaje: 'Notificación enviada por correo.' })
  const edited = await a.editarResenaAction(undefined, form(true))
  const deleted = await a.eliminarResenaAction(undefined, form(true))
  assert.match(edited.mensaje, /Notificación enviada/)
  assert.match(deleted.mensaje, /Notificación enviada/)
  assert.deepEqual(a.notifications.map((n) => n.accion), ['modificada', 'eliminada'])
  for (const n of a.notifications) {
    assert.equal(n.autor.email, 'author@example.test')
    assert.equal(n.solicitada, true)
  }
  assert.ok(a.revalidations.includes('/fichas/2'))
  assert.ok(a.revalidations.includes('/fichas/4'))
})
test('notification is opt-in and legacy document validation reaches the atomic database operation', async () => {
  const a = actions()
  assert.ok((await a.editarResenaAction(undefined, form())).mensaje)
  assert.ok((await a.eliminarResenaAction(undefined, form())).mensaje)
  assert.equal(a.backend.calls[0].params.p_identificacion, 'LEGACY-42')
  assert.ok(a.notifications.every((n) => n.solicitada === false))
})
test('unauthorized or failed mutations never invoke the notification helper', async () => {
  for (const config of [{ rol: 'propietario' }, { activo: false }, { error: { code: '23514', message: 'database failure' } }]) {
    const a = actions(config)
    assert.ok((await a.editarResenaAction(undefined, form(true))).error)
    assert.ok((await a.eliminarResenaAction(undefined, form(true))).error)
    assert.equal(a.notifications.length, 0)
  }
})
test('email failure preserves success and returns a warning even after deletion', async () => {
  const a = actions({}, { advertencia: 'No se pudo enviar el correo.' })
  const result = await a.eliminarResenaAction(undefined, form(true))
  assert.equal(result.error, undefined)
  assert.equal(result.mensaje, 'Reseña eliminada.')
  assert.match(result.advertencia, /correo/)
  assert.equal(a.backend.calls.length, 1)
  assert.ok(a.revalidations.includes('/admin/resenas'))
})
