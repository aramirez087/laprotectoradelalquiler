import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const require = createRequire(import.meta.url)
const cwd = fileURLToPath(new URL('../', import.meta.url))
const pgUrl = pathToFileURL(require.resolve('pg')).href

// Execute the actual CLI in a fresh process, replacing credentials loading and
// pg.Pool before it starts. No environment files or database are ever accessed.
const preload = `
  import pg from ${JSON.stringify(pgUrl)};
  import { readFileSync } from 'node:fs';
  process.loadEnvFile = () => { process.stdout.write('ENV_LOAD\\n'); };
  const files = ['schema.sql', 'db/seeds.sql', 'db/administrar-usuarios.sql',
    'db/invitaciones-admin.sql', 'db/sesiones-admin.sql', 'db/administrar-resenas.sql',
    'db/resenas-unicas.sql', 'db/acceso-temporal-consultas.sql', 'db/seguridad-supabase.sql', 'db/verificacion-cedulas-tse.sql', 'db/resultados-cedulas-tse.sql'];
  pg.Pool = class {
    constructor() { process.stdout.write('POOL_CREATED\\n'); }
    async query(sql) {
      const name = files.find(file => readFileSync(file, 'utf8') === sql);
      if (!name) throw new Error('Unexpected SQL');
      process.stdout.write('APPLIED ' + name + '\\n');
    }
    async end() { process.stdout.write('POOL_CLOSED\\n'); }
  };
`
const preloadUrl = `data:text/javascript,${encodeURIComponent(preload)}`

function run(args, withDatabase = false) {
  const env = { ...process.env, DATABASE_SSL: 'false' }
  delete env.DATABASE_URL
  if (withDatabase) env.DATABASE_URL = 'postgres://postgres@127.0.0.1:1/never_connected'
  return spawnSync(process.execPath, ['--import', preloadUrl, 'scripts/aplicar-esquema.mjs', ...args], {
    cwd, env, encoding: 'utf8', timeout: 15_000,
  })
}

test('unknown migration flags fail before environment loading or any database connection', () => {
  for (const args of [['--solo-admin-usuario'], ['--solo-schema', '--typo'], ['production']]) {
    const result = run(args)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Opciones desconocidas/)
    assert.doesNotMatch(result.stdout, /ENV_LOAD|POOL_CREATED|APPLIED/)
    assert.doesNotMatch(result.stderr, /Falta DATABASE_URL/)
  }
})

test('conflicting or repeated migration flags fail before environment loading or any connection', () => {
  for (const args of [
    ['--solo-schema', '--solo-admin-usuarios'],
    ['--solo-admin-resenas', '--solo-invitaciones-admin'],
    ['--solo-acceso-consultas', '--solo-acceso-consultas'],
  ]) {
    const result = run(args)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /excluyentes/)
    assert.doesNotMatch(result.stdout, /ENV_LOAD|POOL_CREATED|APPLIED/)
  }
})

test('valid additive flags dispatch only their migrations and restore session guards last', () => {
  for (const [flag, expected] of [
    ['--solo-resultados-cedulas', ['db/resultados-cedulas-tse.sql']],
    ['--solo-padron-tse', ['db/verificacion-cedulas-tse.sql']],
    ['--solo-seguridad-supabase', ['db/seguridad-supabase.sql']],
    ['--solo-admin-usuarios', ['db/administrar-usuarios.sql', 'db/invitaciones-admin.sql', 'db/sesiones-admin.sql']],
    ['--solo-invitaciones-admin', ['db/administrar-usuarios.sql', 'db/invitaciones-admin.sql', 'db/sesiones-admin.sql']],
    ['--solo-admin-resenas', ['db/administrar-resenas.sql']],
    ['--solo-acceso-consultas', ['db/resenas-unicas.sql', 'db/acceso-temporal-consultas.sql', 'db/sesiones-admin.sql']],
  ]) {
    const result = run([flag], true)
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual([...result.stdout.matchAll(/^APPLIED (.+)$/gm)].map(match => match[1]), expected)
    assert.match(result.stdout, /POOL_CLOSED/)
  }
})

test('explicit full schema and no-flag setup retain their established behavior', () => {
  for (const [args, expected] of [
    [['--solo-schema'], ['schema.sql']],
    [[], ['schema.sql', 'db/seeds.sql']],
  ]) {
    const result = run(args, true)
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual([...result.stdout.matchAll(/^APPLIED (.+)$/gm)].map(match => match[1]), expected)
    assert.match(result.stdout, /POOL_CLOSED/)
  }
})
