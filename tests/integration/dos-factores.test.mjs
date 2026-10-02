import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()

// Disposable Postgres only: no live accounts, environment files or credentials.
test('optional 2FA protects direct table access and existing session RPCs using live factors', { timeout: 120_000 }, async t => {
  const container = `dos-factores-test-${process.pid}-${Date.now()}`
  let db
  t.after(async () => { await db?.end(); await docker('rm', '-f', container) })
  await docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = Number((await docker('port', container, '5432')).split(':').pop())
  const deadline = Date.now() + 30_000
  while (!db) {
    const candidate = new pg.Client({ connectionString: `postgres://postgres@127.0.0.1:${port}/postgres` })
    try { await candidate.connect(); db = candidate }
    catch (error) {
      await candidate.end()
      if (Date.now() > deadline) throw error
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  await db.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz,
      raw_user_meta_data jsonb DEFAULT '{}');
    CREATE TABLE auth.sessions (id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE auth.mfa_factors (id uuid PRIMARY KEY, user_id uuid, status text, factor_type text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
      SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;`)
  const migration = await readFile('db/dos-factores.sql', 'utf8')
  const schema = await readFile('schema.sql', 'utf8')
  assert.ok(schema.includes(migration), 'fresh installations include the additive MFA migration')
  assert.equal(await readFile('supabase/migrations/20261002171756_dos_factores.sql', 'utf8'), migration)
  assert.ok(schema.includes(await readFile('db/sesiones-admin.sql', 'utf8')), 'fresh installations share the maintained session definition')
  await db.query(schema)
  // Existing installations predate the resumable invitation fields.
  await db.query('ALTER TABLE invitaciones_admin DROP COLUMN sesion_enlace_id, DROP COLUMN enlace_verificado_en')
  await db.query(migration)
  await db.query('SELECT sesion_enlace_id,enlace_verificado_en FROM invitaciones_admin')
  await db.query(migration) // repeat safely without changing data or grants
  const uid = 'a1111111-1111-4111-8111-111111111111'
  const other = 'b2222222-2222-4222-8222-222222222222'
  const session = 'c3333333-3333-4333-8333-333333333333'
  const fid = 'd4444444-4444-4444-8444-444444444444'
  await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2),($3,$4)', [uid, 'mfa@example.test', other, 'other@example.test'])
  await db.query('INSERT INTO auth.sessions VALUES ($1,$2)', [session, uid])
  await db.query("INSERT INTO usuarios(auth_user_id,email,nombre,rol) VALUES ($1,'mfa@example.test','Prueba MFA','propietario'),($2,'other@example.test','Otra Cuenta','propietario')", [uid, other])
  await db.query('INSERT INTO auth.mfa_factors VALUES ($1,$2,$3,$4)', [fid, other, 'verified', 'totp'])
  await db.query("INSERT INTO personas(identificacion,nombre,apellido1) VALUES ('199999999','Prueba','MFA')")
  await db.query("INSERT INTO resenas(persona_id,autor_id,estado) VALUES (1,1,'borrador')")

  async function access(aal, expected) {
    await db.query('SET ROLE authenticated')
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)",
      [uid, JSON.stringify({ sub: uid, session_id: session, ...(aal ? { aal } : {}) })])
    const result = (await db.query('SELECT privado.segundo_factor_verificado() factor, public.mi_sesion_administracion_vigente() session')).rows[0]
    assert.equal(result.factor, expected)
    assert.equal(result.session, expected)
    assert.equal((await db.query('SELECT id FROM usuarios')).rowCount, expected ? 1 : 0, 'profile ownership remains enforced')
    const metadata = await db.query('SELECT * FROM public.mi_acceso_consulta()')
    assert.equal(metadata.rowCount, expected ? 1 : 0, 'the public RPC must not reveal account metadata before MFA')
    if (expected) assert.equal(metadata.rows[0].pendientes, 1, 'verified sessions retain their real review counts')
    await db.query('RESET ROLE')
  }

  await access('aal1', true) // another account's factor never changes this account
  await db.query("UPDATE auth.mfa_factors SET user_id=$1,status='unverified' WHERE id=$2", [uid, fid])
  await access('aal1', true) // starting setup cannot lock out an account
  await db.query("UPDATE auth.mfa_factors SET status='verified' WHERE id=$1", [fid])
  await access('aal1', false) // stale AAL1 JWTs immediately lose private access
  await access(undefined, false) // missing AAL cannot bypass the definer gate
  await access('aal2', true)
  // Simulate the original definer RPC, then exercise the additive upgrade.
  await db.query(await readFile('db/acceso-temporal-consultas.sql', 'utf8'))
  await db.query('SET ROLE authenticated')
  await db.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: uid, session_id: session, aal: 'aal1' })])
  assert.equal((await db.query('SELECT * FROM public.mi_acceso_consulta()')).rowCount, 1, 'legacy RPC fixture exposes metadata')
  await db.query('RESET ROLE')
  await db.query(migration)
  await access('aal1', false)
  await access('aal2', true)
  // Replay each supported maintenance path after MFA, including its older
  // permission definitions. No path may restore partial-session access.
  for (const flag of ['--solo-admin-usuarios', '--solo-invitaciones-admin', '--solo-acceso-consultas']) {
    await exec(process.execPath, ['scripts/aplicar-esquema.mjs', flag], {
      env: { ...process.env, DATABASE_URL: `postgres://postgres@127.0.0.1:${port}/postgres`, DATABASE_SSL: 'false' },
    })
    await access('aal1', false)
    await access('aal2', true)
  }
  await db.query(await readFile('db/sesiones-admin.sql', 'utf8'))
  await access('aal1', false)
  await db.query('DELETE FROM auth.mfa_factors WHERE id=$1', [fid])
  await access('aal1', true) // optional protection can be turned back off
  await db.query('DELETE FROM auth.sessions WHERE id=$1', [session])
  await db.query('SET ROLE authenticated')
  assert.equal((await db.query('SELECT public.mi_sesion_administracion_vigente() live')).rows[0].live, false, 'revoked sessions remain blocked')
  assert.equal((await db.query('SELECT * FROM public.mi_acceso_consulta()')).rowCount, 0, 'revoked sessions cannot see metadata either')
  await db.query('RESET ROLE')
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query("SELECT has_table_privilege($1,'auth.mfa_factors','SELECT') allowed", [role])).rows[0].allowed, false)
    assert.equal((await db.query("SELECT has_table_privilege($1,'invitaciones_admin','SELECT') allowed", [role])).rows[0].allowed, false, 'pending session proofs remain private')
    assert.equal((await db.query("SELECT has_table_privilege($1,'invitaciones_admin','UPDATE') allowed", [role])).rows[0].allowed, false, 'clients cannot forge pending session proofs')
  }
  assert.equal((await db.query("SELECT has_function_privilege('anon','privado.segundo_factor_verificado()','EXECUTE') allowed")).rows[0].allowed, false)
})
