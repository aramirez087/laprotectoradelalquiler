import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()

// Disposable database only. Never read environment files or live credentials.
test('Supabase hardening: confirmed signup, field permissions, RLS, and future grants', { timeout: 120_000 }, async t => {
  const container = `seguridad-test-${process.pid}-${Date.now()}`
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
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
      SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;`)
  const migration = await readFile('db/seguridad-supabase.sql', 'utf8')
  const schema = await readFile('schema.sql', 'utf8')
  assert.ok(schema.includes(migration), 'fresh installs include the security migration unchanged')
  assert.ok(schema.endsWith(await readFile('db/activacion.sql', 'utf8')), 'activation follows security hardening')
  assert.equal(await readFile('supabase/migrations/20260930033313_seguridad_supabase.sql', 'utf8'), migration)
  await db.query(schema)
  await db.query(migration) // repeat application preserves the same permissions
  const uid = 'a1111111-1111-4111-8111-111111111111'
  const session = 'b2222222-2222-4222-8222-222222222222'
  const metadata = { registro_correo: true, nombre: 'Persona Confirmada', identificacion: '102340567',
    facebook: 'https://www.facebook.com/persona.confirmada', rol: 'agencia' }
  await db.query('INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES ($1,$2,$3)', [uid, 'confirmed@example.com', metadata])
  assert.equal((await db.query('SELECT count(*)::int n FROM usuarios')).rows[0].n, 0)
  await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [uid])
  const user = (await db.query('SELECT * FROM usuarios WHERE auth_user_id=$1', [uid])).rows[0]
  assert.equal(user.rol, 'agencia')
  assert.equal(user.email, 'confirmed@example.com')
  assert.equal((await db.query('SELECT count(*)::int n FROM autenticaciones')).rows[0].n, 1)
  await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [uid])
  assert.equal((await db.query('SELECT count(*)::int n FROM usuarios')).rows[0].n, 1)
  await assert.rejects(db.query(`INSERT INTO auth.users (id,email,email_confirmed_at,raw_user_meta_data)
    VALUES ('c3333333-3333-4333-8333-333333333333','forged@example.com',now(),$1)`,
    [{ ...metadata, rol: 'admin' }]), { code: '23514' })
  assert.equal((await db.query("SELECT count(*)::int n FROM auth.users WHERE email='forged@example.com'")).rows[0].n, 0)
  await db.query('INSERT INTO auth.sessions VALUES ($1,$2)', [session, uid])
  const persona = (await db.query("INSERT INTO personas (identificacion,nombre,apellido1) VALUES ('109990999','Inquilino','Prueba') RETURNING id")).rows[0].id
  const published = (await db.query("INSERT INTO resenas (persona_id,autor_id,estado,comentario) VALUES ($1,$2,'publicada','Una experiencia publicada con contenido suficiente.') RETURNING id", [persona, user.id])).rows[0].id
  await db.query(`SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${uid}', false);
    SELECT set_config('request.jwt.claim.role', 'authenticated', false);
    SELECT set_config('request.jwt.claims', '{"session_id":"${session}"}', false);`)
  await assert.rejects(db.query("INSERT INTO personas (identificacion,nombre,apellido1) VALUES ('108880888','Falsa','Ficha')"), { code: '42501' })
  for (const [col, value] of [['verificada', 'true'], ['fuente', "'legacy'"], ['creado_en', 'now()']]) {
    await assert.rejects(db.query(`INSERT INTO resenas (persona_id,autor_id,estado,comentario,${col})
      VALUES ($1,$2,'borrador','Un comentario con suficiente longitud para validar.',${value})`, [persona, user.id]), { code: '42501' })
  }
  await assert.rejects(db.query("INSERT INTO denuncias (resena_id,denunciante_id,motivo,estado) VALUES ($1,$2,'otro','aceptada')", [published, user.id]), { code: '42501' })
  await assert.rejects(db.query("INSERT INTO denuncias (resena_id,denunciante_id,motivo,detalle) VALUES ($1,$2,'otro',$3)", [published, user.id, 'x'.repeat(2001)]), { code: '23514' })
  await db.query("INSERT INTO denuncias (resena_id,denunciante_id,motivo,detalle) VALUES ($1,$2,'otro','Detalle válido')", [published, user.id])
  await db.query('RESET ROLE')
  const report = (await db.query('SELECT estado,resuelta_en FROM denuncias')).rows[0]
  assert.equal(report.estado, 'pendiente')
  assert.equal(report.resuelta_en, null)
  const other = (await db.query("INSERT INTO personas (identificacion,nombre,apellido1) VALUES ('107770777','Otra','Persona') RETURNING id")).rows[0].id
  await db.query('SET ROLE authenticated')
  await assert.rejects(db.query("INSERT INTO resenas (persona_id,autor_id,estado,comentario) VALUES ($1,$2,'publicada','Un comentario con suficiente longitud para validar.')", [other, user.id]), { code: '42501' })
  await assert.rejects(db.query("INSERT INTO resenas (persona_id,autor_id,estado,comentario) VALUES ($1,$2,'borrador','Corto')", [other, user.id]), { code: '23514' })
  await db.query("INSERT INTO resenas (persona_id,autor_id,estado,comentario) VALUES ($1,$2,'borrador','Un comentario con suficiente longitud para validar.')", [other, user.id])
  await db.query('RESET ROLE')
  const draft = (await db.query('SELECT id FROM resenas WHERE persona_id=$1', [other])).rows[0].id
  await db.query('SET ROLE authenticated')
  await assert.rejects(db.query("INSERT INTO denuncias (resena_id,denunciante_id,motivo) VALUES ($1,$2,'otro')", [draft, user.id]), { code: '42501' })
  await db.query('RESET ROLE')
  await db.query('CREATE TABLE public.future_table (id int); CREATE FUNCTION public.future_function() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;')
  for (const role of ['anon', 'authenticated']) {
    const privileges = (await db.query(`SELECT has_table_privilege($1,'public.future_table','SELECT') read,
      has_function_privilege($1,'public.future_function()','EXECUTE') execute`, [role])).rows[0]
    assert.equal(privileges.read, false)
    assert.equal(privileges.execute, false)
  }
})
