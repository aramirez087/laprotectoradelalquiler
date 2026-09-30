import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import vm from 'node:vm'
import test from 'node:test'
import pg from 'pg'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const { PostgrestClient } = require('@supabase/postgrest-js')
const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args, { maxBuffer: 2 * 1024 * 1024 })).stdout.trim()
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

function load(file, mocks = {}) {
  const mod = { exports: {} }
  vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: mod, exports: mod.exports, require: name => mocks[name] ?? require(name),
    Date, Error, Map, Set, URL, console,
  }, { filename: file })
  return mod.exports
}

// Real PostgREST grammar and range responses matter here. The fetch function is
// not mocked; only the session gate is replaced. Never loads .env or live data.
test('user search treats punctuation literally and recovers real PostgREST out-of-range responses', { timeout: 120_000 }, async t => {
  const suffix = `admin-search-${process.pid}-${Date.now()}`
  const network = `${suffix}-net`, database = `${suffix}-db`, rest = `${suffix}-rest`
  let db
  t.after(async () => {
    await db?.end()
    await Promise.allSettled([docker('rm', '-f', rest), docker('rm', '-f', database)])
    await docker('network', 'rm', network)
  })
  await docker('network', 'create', network)
  await docker('run', '--rm', '-d', '--name', database, '--network', network,
    '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=admin_search',
    '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = (await docker('port', database, '5432')).split(':').pop()
  const deadline = Date.now() + 30_000
  while (!db) {
    const candidate = new pg.Client({ connectionString: `postgres://postgres@127.0.0.1:${port}/admin_search` })
    try { await candidate.connect(); db = candidate }
    catch (error) {
      await candidate.end()
      if (Date.now() > deadline) throw error
      await pause(200)
    }
  }
  await db.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.sessions(id uuid PRIMARY KEY, user_id uuid);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$;`)
  await db.query(readFileSync('schema.sql', 'utf8'))
  const fixtures = [
    ['Admin', 'admin@example.com', 'admin'],
    ['Under', 'ana_maria@example.com', 'agencia'],
    ['Other', 'anaXmaria@example.com', 'propietario'],
    ['100% Seguro', 'percent@example.com', 'propietario'],
    ['100X Seguro', 'percent-other@example.com', 'propietario'],
    ['Apellido, nombre', 'comma@example.com', 'propietario'],
    ['Dijo "hola"', 'quote@example.com', 'propietario'],
    ['Grupo (central)', 'parens@example.com', 'propietario'],
    ['Ñ', 'letter@example.com', 'propietario'],
    ['Asterisk * literal', 'star@example.com', 'propietario'],
    ['Brackets [literal]', 'brackets@example.com', 'propietario'],
    ['Back\\slash', 'backslash@example.com', 'propietario'],
    ['Dot . literal', 'dot@example.com', 'propietario'],
    ['Dot X literal', 'dot-other@example.com', 'propietario'],
  ]
  for (const fixture of fixtures) await db.query('INSERT INTO usuarios(nombre,email,rol) VALUES($1,$2,$3)', fixture)
  await db.query("INSERT INTO usuarios(nombre,email) SELECT 'Pagina '||n,'page-'||n||'@example.com' FROM generate_series(1,25)n")

  await docker('run', '--rm', '-d', '--name', rest, '--network', network,
    '-e', `PGRST_DB_URI=postgres://postgres@${database}:5432/admin_search`,
    '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=postgres',
    '-p', '127.0.0.1::3000', 'postgrest/postgrest:v14.2')
  const restPort = (await docker('port', rest, '3000')).split(':').pop()
  const base = `http://127.0.0.1:${restPort}`
  const restDeadline = Date.now() + 30_000
  while (true) {
    try { if ((await fetch(`${base}/usuarios?select=id&limit=1`)).ok) break } catch { /* startup */ }
    if (Date.now() > restDeadline) throw new Error('Disposable PostgREST did not become ready')
    await pause(200)
  }
  const requests = []
  const client = new PostgrestClient(base, { fetch: async (url, options) => {
    const response = await fetch(url, options)
    requests.push({ url: new URL(url), method: options.method, status: response.status })
    return response
  } })
  const api = load('lib/admin.ts', {
    'server-only': {}, '@/lib/supabase/admin': { createAdmin: () => client },
    '@/lib/dal': { requerirRol: async () => ({ id: 1, activo: true }) },
    '@/lib/acceso-consulta': load('lib/acceso-consulta.ts'), '@/lib/periodo': {}, '@/lib/util': load('lib/util.ts'),
  })

  await t.test('literal email and punctuation never become SQL or regex wildcards', async () => {
    for (const [q, expected] of [
      ['ana_maria@example.com', [2]], ['%', [4]], [',', [6]], ['"', [7]],
      ['(', [8]], [')', [8]], ['ñ', [9]], ['*', [10]], ['[', [11]],
      [']', [11]], ['\\', [12]], ['Dot . literal', [13]],
    ]) {
      const result = await api.buscarUsuarios({ q })
      assert.deepEqual(Array.from(result.filas, row => row.id), expected, `literal search ${JSON.stringify(q)}`)
      assert.equal(result.total, expected.length)
    }
  })
  await t.test('role filtering and exact totals apply in the database', async () => {
    const result = await api.buscarUsuarios({ rol: 'agencia' })
    assert.deepEqual(Array.from(result.filas, row => row.id), [2])
    assert.equal(result.total, 1)
  })
  await t.test('real HTTP 416 is recovered with a filtered count for the page redirect', async () => {
    requests.length = 0
    const result = await api.buscarUsuarios({ q: 'Pagina', pagina: 9 })
    assert.equal(result.total, 25)
    assert.equal(result.filas.length, 0)
    assert.ok(requests.some(request => request.status === 416), 'the server actually returned a range error')
    assert.ok(requests.some(request => request.method === 'HEAD' && request.url.searchParams.has('or')), 'recovery counts the selected view')
  })
})
