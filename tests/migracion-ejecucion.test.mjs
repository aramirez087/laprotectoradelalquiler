import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import { resumenDesdeSalida } from '../lib/resultado-migracion-legacy.ts'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const resumen = {
  estado: 'completada', lookups: {}, personas: 0, usuarios: 0, resenas: 0,
  claves: { bcrypt: 0, anterior: 0, restablecer: 0 },
  auth: { creadas: 0, fallidas: 0 }, advertencias: [],
  accesos: { total: 1, existentes: 1, inactivas: 0, sinCorreo: 0, sinOrigen: 0, conflictos: 0,
    elegibles: 0, creadas: 0, enlazadas: 0, pendientes: 0, fallidas: 0, conservadas: 0, restablecer: 0, siguienteId: 0 },
}

function worker(signal = null) {
  const calls = []
  const mocks = {
    'server-only': {},
    'mysql2/promise': {},
    '../scripts/legacy-tablas.mjs': {},
    '@/lib/resultado-migracion-legacy': { resumenDesdeSalida },
    'node:child_process': { spawn: (command, args, options) => {
      calls.push({ command, args, options })
      const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() })
      queueMicrotask(() => {
        child.stdout.emit('data', Buffer.from(`=== Resumen ===\n${JSON.stringify(resumen)}`))
        child.emit('close', signal ? null : 0, signal)
      })
      return child
    } },
  }
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync('lib/migracion-legacy.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, {
    module: mod, exports: mod.exports, require: (name) => mocks[name] ?? require(name),
    process, Buffer, setTimeout, clearTimeout, Error,
  })
  return { ...mod.exports, calls }
}

test('admin login operation launches a bounded access-only worker without reimporting users', async () => {
  const h = worker()
  const result = await h.ejecutarMigracionLegacy({ host: 'source', port: 3306, user: 'reader', password: 'fixture-secret', database: 'legacy' }, true, false, 'usuarios', 123)
  const { args, options } = h.calls[0]
  assert.ok(args.includes('--solo-accesos'))
  assert.ok(args.includes('--crear-accounts'))
  assert.ok(args.includes('--limite-auth=100'))
  assert.ok(args.includes('--tiempo-auth=150'))
  assert.ok(args.includes('--despues-auth=123'))
  assert.ok(args.every((arg) => !arg.startsWith('--pasos=')))
  assert.ok(args.every((arg) => !arg.includes('fixture-secret')))
  assert.equal(options.env.LEGACY_MYSQL_PASSWORD, 'fixture-secret')
  assert.equal(result.resumen.accesos.existentes, 1)
})

test('an interrupted login-only worker reports resumable access creation instead of an import rollback', async () => {
  const h = worker('SIGTERM')
  await assert.rejects(h.ejecutarMigracionLegacy({ host: 'source', port: 3306, user: 'reader', password: '', database: 'legacy' }, true, false, 'usuarios'), /accesos completados se conservan/)
})
