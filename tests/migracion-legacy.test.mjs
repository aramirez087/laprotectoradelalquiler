import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { resumenDesdeSalida } from '../lib/resultado-migracion-legacy.ts'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const resumen = {
  estado: 'completada', lookups: {}, personas: 1, usuarios: 1, resenas: 1,
  claves: { bcrypt: 0, anterior: 0, restablecer: 1 },
  auth: { creadas: 0, fallidas: 0 }, advertencias: [],
}
const accesos = {
  total: 6421, existentes: 3, inactivas: 83, sinCorreo: 6055, sinOrigen: 0, conflictos: 0,
  elegibles: 280, creadas: 90, enlazadas: 10, pendientes: 180, fallidas: 0, conservadas: 80, restablecer: 10, siguienteId: 100,
}
const salida = (r) => `Diagnostic output\n=== Resumen ===\n${JSON.stringify(r)}`

test('import result never turns a failed or malformed result into success', () => {
  assert.deepEqual(resumenDesdeSalida(salida(resumen), 0), resumen)
  assert.throws(() => resumenDesdeSalida(salida(resumen), 1), /inconsistente/)
  assert.throws(() => resumenDesdeSalida(salida(resumen), 2), /inconsistente/)
  assert.throws(() => resumenDesdeSalida('no summary', 0), /sin entregar/)
  assert.throws(() => resumenDesdeSalida(salida({ ...resumen, resenas: -1 }), 0), /incompleto/)
  assert.throws(() => resumenDesdeSalida(salida({ ...resumen, auth: { creadas: 0, fallidas: 1 } }), 0), /inconsistente/)
  const parcial = { ...resumen, estado: 'parcial', auth: { creadas: 1, fallidas: 1 } }
  assert.deepEqual(resumenDesdeSalida(salida(parcial), 2), parcial)
})

test('import result retains archive and consolidation counts for real imports and simulations', () => {
  for (const estado of ['completada', 'simulacion']) {
    const resultado = {
      ...resumen, estado,
      fichas: { leidas: 5, archivadas: 5, consolidadas: 3, conservadas: 1 },
    }
    assert.deepEqual(resumenDesdeSalida(salida(resultado), 0), resultado)
  }
})

test('import result rejects incomplete or invalid archive counts', () => {
  const fichas = { leidas: 5, archivadas: 5, consolidadas: 3, conservadas: 1 }
  for (const campo of Object.keys(fichas)) {
    for (const valor of [-1, 1.5, '1', undefined]) {
      assert.throws(() => resumenDesdeSalida(salida({
        ...resumen, fichas: { ...fichas, [campo]: valor },
      }), 0), /incompleto/)
    }
  }
})

function acciones({ activo = true, resultado = { resumen, observaciones: [] }, diagnostico = { tablas: 64, personas: 1, fichas: 7107, usuarios: 6017 }, errorConexion, destino = { baseDatos: true, auth: true } } = {}) {
  const llamadas = []
  const mocks = {
    'next/cache': { revalidatePath: (ruta) => llamadas.push(['revalidate', ruta]) },
    'next/navigation': { unstable_rethrow() {} },
    '@/lib/dal': { requerirRol: async (rol) => { assert.equal(rol, 'admin'); return { activo } } },
    '@/lib/migracion-legacy': {
      configuracionDestinoLegacy: () => destino,
      ejecutarMigracionLegacy: async (...args) => { llamadas.push(['importar', ...args]); return resultado },
      probarConexionLegacy: async () => {
        if (errorConexion) throw errorConexion
        return diagnostico
      },
    },
  }
  const codigo = ts.transpileModule(readFileSync(new URL('../lib/actions/migracion-legacy.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const modulo = { exports: {} }
  vm.runInNewContext(codigo, { module: modulo, exports: modulo.exports, require: (nombre) => mocks[nombre] ?? require(nombre), Error, console })
  return { ...modulo.exports, llamadas }
}
function formulario(modo, confirmar = false) {
  const f = new FormData()
  for (const [k, v] of Object.entries({ host: 'localhost', port: '3306', database: 'legacy', user: 'reader', password: '', modo, crearCuentas: 'on' })) f.set(k, v)
  if (confirmar) f.set('confirmar', 'si')
  return f
}

test('connection test explains the missing person catalog without hiding available reviews and users', async () => {
  const a = acciones({ diagnostico: { tablas: 64, personas: null, fichas: 7107, usuarios: 6017 } })
  const r = await a.migrarLegacyAction(undefined, formulario('probar'))
  assert.equal(r.error, undefined)
  assert.equal(r.diagnostico.fichas, 7107)
  assert.equal(r.diagnostico.usuarios, 6017)
  assert.match(r.observaciones[0], /tb_persona/)
  assert.match(r.observaciones[0], /inactivos/)
  assert.equal(a.llamadas.length, 0)
})

test('connection test rejects a missing review table but accepts a readable empty one', async () => {
  for (const fichas of [null, 0]) {
    const a = acciones({ diagnostico: { tablas: 64, personas: 1, fichas, usuarios: 6017 } })
    const r = await a.migrarLegacyAction(undefined, formulario('probar'))
    if (fichas == null) assert.match(r.error, /tb_inquilinos_no_nacionales/)
    else assert.equal(r.error, undefined)
  }
})

test('connection test reports missing SELECT permission instead of suggesting a partial import', async () => {
  const a = acciones({ errorConexion: new Error('MySQL no permite leer la tabla tb_persona. Revise los permisos SELECT de la cuenta de lectura.') })
  const r = await a.migrarLegacyAction(undefined, formulario('probar'))
  assert.match(r.error, /permisos SELECT/)
  assert.equal(r.observaciones, undefined)
})

test('simulation validates without import confirmation or Auth mutations', async () => {
  const a = acciones({ resultado: { resumen: { ...resumen, estado: 'simulacion' }, observaciones: [] } })
  const r = await a.migrarLegacyAction(undefined, formulario('simular'))
  assert.equal(r.tipo, 'simulacion')
  assert.equal(r.error, undefined)
  const [, , crearAuth, simular] = a.llamadas[0]
  assert.equal(crearAuth, false)
  assert.equal(simular, true)
  assert.equal(a.llamadas.length, 1, 'simulation must not revalidate committed data')
})
test('real import requires confirmation and an active admin', async () => {
  const a = acciones()
  assert.match((await a.migrarLegacyAction(undefined, formulario('importar'))).error, /Confirme/)
  assert.equal(a.llamadas.length, 0)
  const inactivo = acciones({ activo: false })
  assert.match((await inactivo.migrarLegacyAction(undefined, formulario('importar', true))).error, /inactiva/)
  assert.equal(inactivo.llamadas.length, 0)
})
test('access-only action provisions a bounded batch for imported users and reports remaining accounts', async () => {
  const a = acciones({ resultado: { resumen: { ...resumen, estado: 'parcial', accesos }, observaciones: [] } })
  assert.match((await a.migrarLegacyAction(undefined, formulario('usuarios'))).error, /Confirme/)
  assert.equal(a.llamadas.length, 0)

  const datos = formulario('usuarios', true)
  datos.delete('crearCuentas')
  datos.set('despuesDeAuth', '123')
  const r = await a.migrarLegacyAction(undefined, datos)
  assert.equal(r.tipo, 'usuarios')
  assert.equal(r.error, undefined)
  assert.match(r.mensaje, /180 accesos pendientes/)
  assert.equal(r.resumen.accesos.total, 6421)
  const importacion = a.llamadas.find(([tipo]) => tipo === 'importar')
  assert.equal(importacion[2], true)
  assert.equal(importacion[3], false)
  assert.equal(importacion[4], 'usuarios')
  assert.equal(importacion[5], 123)
  assert.ok(a.llamadas.some(([tipo, ruta]) => tipo === 'revalidate' && ruta === '/admin/usuarios'))
})

test('access-only action distinguishes completion from unresolved or failed accounts', async () => {
  const completas = { ...accesos, existentes: 283, elegibles: 0, creadas: 0, enlazadas: 0, pendientes: 0, conservadas: 0, restablecer: 0, siguienteId: 0 }
  const ok = acciones({ resultado: { resumen: { ...resumen, accesos: completas }, observaciones: [] } })
  assert.match((await ok.migrarLegacyAction(undefined, formulario('usuarios', true))).mensaje, /Todas las cuentas elegibles/)
  for (const pendiente of ['fallidas', 'conflictos', 'sinOrigen']) {
    const a = acciones({ resultado: { resumen: { ...resumen, estado: 'parcial', accesos: { ...accesos, [pendiente]: 1 } }, observaciones: ['Requiere revisión'] } })
    const r = await a.migrarLegacyAction(undefined, formulario('usuarios', true))
    assert.match(r.error, /requieren atención/)
    assert.equal(r.mensaje, undefined)
  }
  const missing = acciones()
  assert.match((await missing.migrarLegacyAction(undefined, formulario('usuarios', true))).error, /No recibimos el conteo/)
  const inactive = acciones({ activo: false })
  assert.match((await inactive.migrarLegacyAction(undefined, formulario('usuarios', true))).error, /inactiva/)
  assert.equal(inactive.llamadas.length, 0)
})

test('access coverage survives parsing and inconsistent or falsely complete coverage is rejected', () => {
  const parcial = { ...resumen, estado: 'parcial', accesos }
  assert.deepEqual(resumenDesdeSalida(salida(parcial), 2).accesos, accesos)
  assert.throws(() => resumenDesdeSalida(salida({ ...parcial, estado: 'completada' }), 0), /conteo.*inconsistente/)
  for (const campo of ['total', 'elegibles', 'creadas', 'enlazadas', 'pendientes', 'conservadas', 'restablecer']) {
    assert.throws(() => resumenDesdeSalida(salida({ ...parcial, accesos: { ...accesos, [campo]: accesos[campo] + 1 } }), 2), /conteo.*inconsistente/)
  }
  assert.throws(() => resumenDesdeSalida(salida({ ...parcial, accesos: { ...accesos, fallidas: 181 } }), 2), /conteo.*inconsistente/)
})

test('user import refuses to create accounts when Supabase Auth is not configured', async () => {
  const a = acciones({ destino: { baseDatos: true, auth: false } })
  const r = await a.migrarLegacyAction(undefined, formulario('usuarios', true))
  assert.match(r.error, /clave secreta/)
  assert.equal(a.llamadas.length, 0)
})

test('partial Auth success retains the summary and refreshes imported data while showing an error', async () => {
  const a = acciones({ resultado: { resumen: { ...resumen, estado: 'parcial' }, observaciones: ['Accesos pendientes'] } })
  const r = await a.migrarLegacyAction(undefined, formulario('importar', true))
  assert.match(r.error, /faltan accesos/)
  assert.equal(r.mensaje, undefined)
  assert.equal(r.resumen.resenas, 1)
  assert.ok(a.llamadas.some(([tipo]) => tipo === 'revalidate'))
})
