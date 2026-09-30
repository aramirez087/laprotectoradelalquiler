import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()

// Every database and HTTP request stays in disposable local fixtures. The
// subprocess gets explicit overrides for all production connection aliases.
test('bulk imported-profile access stays read-only by default and fails closed while provisioning', { timeout: 120_000 }, async (t) => {
  const container = `imported-access-test-${process.pid}-${Date.now()}`
  let db, server
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve))
    await db?.end()
    await docker('rm', '-f', container)
  })
  await docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=access_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = Number((await docker('port', container, '5432')).split(':').pop())
  const databaseUrl = `postgres://postgres@127.0.0.1:${port}/access_test`
  const deadline = Date.now() + 30_000
  while (!db) {
    const candidate = new pg.Client({ connectionString: databaseUrl })
    try { await candidate.connect(); db = candidate }
    catch (error) {
      await candidate.end()
      if (Date.now() > deadline) throw error
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  await db.query(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text UNIQUE, encrypted_password text,
      email_confirmed_at timestamptz, raw_app_meta_data jsonb NOT NULL DEFAULT '{}', raw_user_meta_data jsonb NOT NULL DEFAULT '{}');
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY, user_id uuid);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
      SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;`)
  await db.query(await readFile('schema.sql', 'utf8'))
  await db.query(`
    CREATE ROLE access_preview_reader LOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public, privado, auth TO access_preview_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA public, privado, auth TO access_preview_reader;
    ALTER ROLE access_preview_reader SET default_transaction_read_only = on`)
  const requests = []
  let handleAuth
  const createIdentity = async (body, res, { marker = body.app_metadata, returnedId } = {}) => {
    const id = randomUUID()
    await db.query(`INSERT INTO auth.users(id,email,encrypted_password,email_confirmed_at,raw_app_meta_data)
      VALUES ($1,$2,$3,CASE WHEN $4 THEN now() END,$5)`, [id, body.email, body.password, body.email_confirm, marker])
    res.end(JSON.stringify({ id: returnedId ?? id, email: body.email, aud: 'authenticated', role: 'authenticated' }))
    return id
  }
  server = createServer(async (req, res) => {
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString())
      requests.push({ method: req.method, path: req.url, body })
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Supabase-Api-Version', '2024-01-01')
      await handleAuth(body, res)
    } catch {
      res.statusCode = 500
      res.end(JSON.stringify({ code: 'fixture_error', msg: 'Local fixture failed.' }))
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const authUrl = `http://127.0.0.1:${server.address().port}`
  const env = {
    ...process.env, DATABASE_URL: databaseUrl, POSTGRES_URL: '', POSTGRES_URL_NON_POOLING: '',
    DATABASE_SSL: 'false', SUPABASE_URL: authUrl, NEXT_PUBLIC_SUPABASE_URL: '',
    SUPABASE_SECRET_KEY: 'test-only-key', SUPABASE_SERVICE_ROLE_KEY: '',
  }
  const run = async (args = [], overrides = {}) => {
    let result
    try { result = { code: 0, ...await exec(process.execPath, ['scripts/provisionar-accesos-importados.mjs', ...args], { env: { ...env, ...overrides }, maxBuffer: 1024 * 1024 }) } }
    catch (error) { result = error }
    let summary
    try { summary = JSON.parse(result.stdout) } catch { /* Configuration errors need not have a summary. */ }
    return { ...result, summary }
  }
  const reset = async () => {
    requests.length = 0
    handleAuth = createIdentity
    await db.query(`TRUNCATE usuarios, auth.users, invitaciones_admin, privado.invitaciones_admin_emisiones
      RESTART IDENTITY CASCADE`)
  }
  const profile = async (email, extra = {}) => {
    const { rows } = await db.query(`INSERT INTO usuarios(email,nombre,identificacion,telefono,rol,activo,auth_user_id)
      VALUES ($1,$2,$3,'8888-8888',$4,$5,$6) RETURNING *`,
    [email, extra.nombre ?? 'Fixture profile', extra.document ?? null, extra.rol ?? 'propietario', extra.activo ?? true, extra.authId ?? null])
    return rows[0]
  }
  const snapshot = async () => ({
    profiles: (await db.query('SELECT * FROM usuarios ORDER BY id')).rows,
    auth: (await db.query('SELECT * FROM auth.users ORDER BY id')).rows,
    audit: (await db.query('SELECT * FROM privado.administracion_usuarios_historial ORDER BY id')).rows,
    invitations: (await db.query('SELECT * FROM invitaciones_admin ORDER BY id')).rows,
    sequences: (await db.query('SELECT schemaname,sequencename,last_value FROM pg_sequences ORDER BY schemaname,sequencename')).rows,
  })

  await t.test('preview requires only read permissions and excludes unsafe existing profiles', async () => {
    await reset()
    await profile('owner@access-fixture.net', { document: '111111111' })
    await profile('agency@access-fixture.net', { document: '222222222', rol: 'agencia' })
    await profile('tenant@access-fixture.net', { document: '333333333', rol: 'inquilino' })
    await profile('inactive@access-fixture.net', { activo: false })
    const admin = await profile('admin@access-fixture.net', { rol: 'admin' })
    await profile('author@legacy.laprotec')
    await profile('invalid-mail')
    await profile('duplicate@access-fixture.net')
    await profile('DUPLICATE@access-fixture.net')
    await profile('document-a@access-fixture.net', { document: '123456789' })
    await profile('document-b@access-fixture.net', { document: '1-2345-6789' })
    const linkedId = randomUUID(), occupiedId = randomUUID()
    await db.query(`INSERT INTO auth.users(id,email,encrypted_password) VALUES
      ($1,'already-linked@access-fixture.net','unchanged-existing-password'),
      ($2,'existing-auth@access-fixture.net','unchanged-orphan-password')`, [linkedId, occupiedId])
    await profile('already-linked@access-fixture.net', { authId: linkedId })
    await profile('existing-auth@access-fixture.net')
    const invited = await profile('invited@access-fixture.net')
    await db.query(`INSERT INTO invitaciones_admin(id,email,nombre,auth_user_id,invitado_por,token_digest,tipo,vence_en,target_usuario_id,target_version,proposito)
      VALUES ($1,$2,'Invited',$3,$4,$5,'invite',now()+interval '1 hour',$6,$7,'acceso')`,
    [randomUUID(), invited.email, randomUUID(), admin.id, 'a'.repeat(64), invited.id, invited.actualizado_en])
    const before = await snapshot()
    const preview = await run([], {
      DATABASE_URL: `postgres://access_preview_reader@127.0.0.1:${port}/access_test`,
      SUPABASE_URL: '', SUPABASE_SECRET_KEY: '',
    })
    assert.equal(preview.code, 0, preview.stderr)
    assert.equal(preview.summary.modo, 'vista_previa')
    assert.equal(preview.summary.conteos.total, 14)
    assert.equal(preview.summary.conteos.elegibles, 3)
    assert.equal(preview.summary.conteos.existentes, 1)
    assert.equal(preview.summary.conteos.inactivas, 1)
    assert.equal(preview.summary.conteos.administradores, 1)
    assert.equal(preview.summary.conteos.sinCorreo, 2)
    assert.equal(preview.summary.conteos.conflictos, 4)
    assert.equal(preview.summary.conteos.authExistente, 1)
    assert.equal(preview.summary.conteos.invitacionesPendientes, 1)
    assert.equal(preview.summary.creadas, 0)
    assert.equal(requests.length, 0)
    assert.deepEqual(await snapshot(), before, 'preview must preserve all data and sequence values')
    assert.ok(!preview.stdout.includes('@access-fixture.net'), 'the summary must not expose account emails')
  })

  await t.test('apply creates private random passwords without mail and preserves every profile field', async () => {
    await reset()
    const profiles = []
    for (const rol of ['propietario', 'agencia', 'inquilino']) profiles.push(await profile(`${rol}@access-fixture.net`, { rol }))
    const result = await run(['--aplicar'])
    assert.equal(result.code, 0, result.stderr)
    assert.equal(result.summary.creadas, 3)
    assert.equal(requests.length, 3)
    assert.ok(requests.every((r) => r.method === 'POST' && r.path === '/auth/v1/admin/users'), 'only user creation is permitted; no invitation or recovery mail request')
    assert.equal(new Set(requests.map((r) => r.body.password)).size, 3)
    for (const request of requests) {
      assert.equal(request.body.email_confirm, true)
      assert.ok(request.body.password.length >= 32 && request.body.password.length <= 72)
      assert.equal(request.body.password_hash, undefined)
      assert.equal(result.stdout.includes(request.body.password), false)
      assert.equal(result.stderr.includes(request.body.password), false)
      assert.equal(request.body.app_metadata.provision_acceso.lote, result.summary.lote)
    }
    const after = (await db.query('SELECT * FROM usuarios ORDER BY id')).rows
    const unchangedFields = profile => {
      const rest = { ...profile }
      delete rest.auth_user_id
      delete rest.actualizado_en
      return rest
    }
    assert.deepEqual(after.map(unchangedFields), profiles.map(unchangedFields))
    assert.ok(after.every((p) => p.auth_user_id))
    const repeat = await run(['--aplicar'])
    assert.equal(repeat.code, 0, repeat.stderr)
    assert.equal(repeat.summary.creadas, 0)
    assert.equal(requests.length, 3)
  })

  await t.test('existing Auth accounts are never relinked, reset, deleted or modified', async () => {
    await reset()
    const id = randomUUID()
    await db.query("INSERT INTO auth.users(id,email,encrypted_password) VALUES ($1,'EXISTING@access-fixture.net','keep-this-password')", [id])
    await profile('existing@access-fixture.net')
    const before = await snapshot()
    const result = await run(['--aplicar'])
    assert.equal(result.summary.conteos.authExistente, 1)
    assert.equal(result.summary.creadas, 0)
    assert.equal(requests.length, 0)
    assert.deepEqual(await snapshot(), before)
  })

  await t.test('inactive unlinked document duplicates do not block the active profile; active or linked duplicates do', async () => {
    await reset()
    const active = await profile('active@access-fixture.net', { document: '123456789' })
    const inactive = await profile('inactive@access-fixture.net', { document: '1-2345-6789', activo: false })
    const linkedId = randomUUID()
    await db.query("INSERT INTO auth.users(id,email,encrypted_password) VALUES ($1,'linked@access-fixture.net','keep-this-password')", [linkedId])
    await profile('linked@access-fixture.net', { document: '222222222', activo: false, authId: linkedId })
    await profile('blocked-linked@access-fixture.net', { document: '222222222' })
    await profile('duplicate-a@access-fixture.net', { document: '333333333' })
    await profile('duplicate-b@access-fixture.net', { document: '333333333' })
    const result = await run(['--aplicar'])
    assert.equal(result.code, 0, result.stderr)
    assert.equal(result.summary.creadas, 1)
    assert.equal(result.summary.conteos.conflictos, 3)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].body.email, active.email)
    assert.deepEqual((await db.query('SELECT * FROM usuarios WHERE id=$1', [inactive.id])).rows[0], inactive)
    assert.equal((await db.query('SELECT encrypted_password FROM auth.users WHERE id=$1', [linkedId])).rows[0].encrypted_password, 'keep-this-password')
  })

  await t.test('an Auth rejection leaves the profile unchanged and reports incomplete provisioning', async () => {
    await reset()
    await profile('rejected@access-fixture.net')
    handleAuth = async (_body, res) => {
      res.statusCode = 422
      res.end(JSON.stringify({ code: 'email_address_invalid', msg: 'Fixture rejection.' }))
    }
    const before = await snapshot()
    const result = await run(['--aplicar'])
    assert.equal(result.code, 2, result.stderr)
    assert.equal(result.summary.creadas, 0)
    assert.equal(result.summary.fallidas, 1)
    assert.deepEqual(await snapshot(), before)
  })

  await t.test('identity marker mismatch never grants access and is excluded from a later retry', async () => {
    await reset()
    await profile('wrong-marker@access-fixture.net')
    handleAuth = async (body, res) => createIdentity(body, res, { marker: {} })
    const result = await run(['--aplicar'])
    assert.equal(result.code, 2, result.stderr)
    assert.equal(result.summary.creadas, 0)
    assert.ok(result.summary.requierenRevision > 0)
    assert.equal((await db.query('SELECT auth_user_id FROM usuarios')).rows[0].auth_user_id, null)
    const retry = await run(['--aplicar'])
    assert.equal(retry.summary.conteos.authExistente, 1)
    assert.equal(requests.length, 1, 'the orphan must not be recreated, relinked or deleted')
  })

  await t.test('SQL link failure preserves the external identity and stops before the next account', async () => {
    await reset()
    await profile('db-failure@access-fixture.net')
    await profile('not-attempted@access-fixture.net')
    await db.query(`CREATE FUNCTION public.fixture_refuse_link() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.auth_user_id IS NOT NULL THEN RAISE EXCEPTION 'fixture link failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_refuse_link BEFORE UPDATE OF auth_user_id ON usuarios FOR EACH ROW EXECUTE FUNCTION public.fixture_refuse_link()`)
    try {
      const result = await run(['--aplicar'])
      assert.equal(result.code, 2, result.stderr)
      assert.equal(result.summary.creadas, 0)
      assert.ok(result.summary.requierenRevision > 0)
      assert.equal(requests.length, 1)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM auth.users')).rows[0].n, 1)
      assert.equal((await db.query('SELECT count(*)::int AS n FROM usuarios WHERE auth_user_id IS NOT NULL')).rows[0].n, 0)
    } finally {
      await db.query('DROP TRIGGER fixture_refuse_link ON usuarios; DROP FUNCTION public.fixture_refuse_link()')
    }
  })

  await t.test('bounded batches resume without reprovisioning completed profiles', async () => {
    await reset()
    for (let i = 0; i < 3; i++) await profile(`batch-${i}@access-fixture.net`)
    const first = await run(['--aplicar', '--limite=2'])
    assert.equal(first.code, 2, first.stderr)
    assert.equal(first.summary.creadas, 2)
    assert.ok(first.summary.siguienteId > 0)
    const second = await run(['--aplicar', '--limite=2', `--despues=${first.summary.siguienteId}`])
    assert.equal(second.code, 0, second.stderr)
    assert.equal(second.summary.creadas, 1)
    assert.equal(requests.length, 3)
    assert.equal(new Set(requests.map((r) => r.body.email)).size, 3)
  })
})
