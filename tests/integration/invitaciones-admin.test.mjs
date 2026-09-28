import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()

// Always use a disposable database; never load .env or use a live DATABASE_URL.
test('admin invitations and first-review access enforce server and database boundaries', { timeout: 120_000 }, async (t) => {
  const container = `admin-invites-test-${process.pid}-${Date.now()}`
  let db
  t.after(async () => {
    await db?.end()
    await docker('rm', '-f', container)
  })
  await docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=admin_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = Number((await docker('port', container, '5432')).split(':').pop())
  const connectionString = `postgres://postgres@127.0.0.1:${port}/admin_test`
  const deadline = Date.now() + 30_000
  while (!db) {
    const candidate = new pg.Client({ connectionString })
    try { await candidate.connect(); db = candidate }
    catch (error) {
      await candidate.end()
      if (Date.now() > deadline) throw error
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  const schema = await readFile('schema.sql', 'utf8')
  const migration = await readFile('db/invitaciones-admin.sql', 'utf8')
  assert.ok(schema.includes(migration))
  await db.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;`)
  await db.query(schema)
  await db.query(migration)
  const uid = 'a1111111-1111-4111-8111-111111111111'
  const inviteUid = 'b2222222-2222-4222-8222-222222222222'
  const inviteId = 'c3333333-3333-4333-8333-333333333333'
  const seed = async () => {
    await db.query(`RESET ROLE; RESET request.jwt.claim.role; RESET request.jwt.claim.sub;
      TRUNCATE usuarios, personas, resenas, invitaciones_admin RESTART IDENTITY CASCADE;
      INSERT INTO usuarios (nombre,email,rol,auth_user_id) VALUES ('Admin','admin@example.test','admin','${uid}');
      INSERT INTO invitaciones_admin(id,email,nombre,auth_user_id,invitado_por,token_digest,tipo,vence_en)
        VALUES ('${inviteId}','invited@example.test','Invited Admin','${inviteUid}',1,'digest','invite',now()+interval '1 hour');`)
  }
  const accept = (authId = inviteUid, token = 'digest') => db.query('SELECT aceptar_invitacion_admin($1,$2,$3)', [inviteId, authId, token])
  await t.test('pending invitation confers no privileges and successful acceptance atomically consumes it', async () => {
    await seed()
    assert.equal((await db.query('SELECT count(*)::int AS n FROM usuarios')).rows[0].n, 1)
    await db.query('SET ROLE service_role')
    await accept()
    await db.query('RESET ROLE')
    const result = (await db.query('SELECT rol,activo FROM usuarios WHERE auth_user_id=$1', [inviteUid])).rows[0]
    assert.deepEqual(result, { rol: 'admin', activo: true })
    assert.ok((await db.query('SELECT aceptada_en FROM invitaciones_admin')).rows[0].aceptada_en)
    await assert.rejects(accept())
  })
  await t.test('wrong identity, replaced token, expired invitation and revoked inviter fail closed', async () => {
    for (const mutation of [
      "UPDATE invitaciones_admin SET token_digest='new-token'",
      "UPDATE invitaciones_admin SET vence_en=now()-interval '1 minute'",
      "UPDATE usuarios SET activo=false WHERE id=1",
      "UPDATE usuarios SET rol='propietario' WHERE id=1",
    ]) {
      await seed()
      await db.query(mutation)
      await assert.rejects(accept())
      assert.equal((await db.query('SELECT count(*)::int AS n FROM usuarios')).rows[0].n, 1)
      assert.equal((await db.query('SELECT aceptada_en FROM invitaciones_admin')).rows[0].aceptada_en, null)
    }
    await seed()
    await assert.rejects(accept(uid))
  })
  await t.test('existing accounts cannot be promoted or reactivated through an invitation', async () => {
    await seed()
    await db.query("INSERT INTO usuarios(nombre,email,rol,activo,auth_user_id) VALUES ('Existing','invited@example.test','propietario',false,$1)", [inviteUid])
    await assert.rejects(accept())
    assert.deepEqual((await db.query('SELECT rol,activo FROM usuarios WHERE auth_user_id=$1', [inviteUid])).rows[0], { rol: 'propietario', activo: false })
  })
  await t.test('failed late update rolls back the new admin profile', async () => {
    await seed()
    await db.query(`CREATE FUNCTION fail_invitation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END $$;
      CREATE TRIGGER fail_invitation BEFORE UPDATE ON invitaciones_admin FOR EACH ROW EXECUTE FUNCTION fail_invitation();`)
    await assert.rejects(accept())
    assert.equal((await db.query('SELECT count(*)::int AS n FROM usuarios')).rows[0].n, 1)
    await db.query('DROP TRIGGER fail_invitation ON invitaciones_admin; DROP FUNCTION fail_invitation()')
  })
  await t.test('anonymous and signed-in users cannot read or mutate invitations or invoke activation RPC', async () => {
    await seed()
    for (const role of ['anon', 'authenticated']) {
      await db.query(`SET ROLE ${role}`)
      await assert.rejects(db.query('SELECT * FROM invitaciones_admin'), { code: '42501' })
      await assert.rejects(db.query("UPDATE invitaciones_admin SET aceptada_en=null"), { code: '42501' })
      await assert.rejects(accept(), { code: '42501' })
      await db.query('RESET ROLE')
    }
  })
  await t.test('live RLS rules deny ordinary users without approved reviews and prevent self-promotion', async () => {
    await seed()
    await db.query(`INSERT INTO usuarios(nombre,email,rol,auth_user_id) VALUES ('Ordinary','ordinary@example.test','propietario','${inviteUid}');
      INSERT INTO personas(identificacion,nombre,apellido1) VALUES ('102340567','Tenant','Test');
      INSERT INTO resenas(persona_id,autor_id,comentario,estado) VALUES (1,1,'Admin review','publicada');`)
    async function visible(authId) {
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.role','authenticated',false)", [authId])
      await db.query('SET ROLE authenticated')
      const rows = (await db.query('SELECT id FROM personas')).rows.length
      await assert.rejects(db.query("UPDATE usuarios SET rol='admin' WHERE auth_user_id=$1", [authId]), { code: '42501' })
      await db.query('RESET ROLE; RESET request.jwt.claim.role')
      return rows
    }
    assert.equal(await visible(inviteUid), 0)
    assert.equal(await visible(uid), 1, 'admin exempt without own required review')
    await db.query("INSERT INTO resenas(persona_id,autor_id,comentario,estado) VALUES (1,2,'Pending','borrador')")
    assert.equal(await visible(inviteUid), 0)
    await db.query("UPDATE resenas SET estado='oculta' WHERE autor_id=2")
    assert.equal(await visible(inviteUid), 0)
    await db.query("UPDATE resenas SET estado='publicada' WHERE autor_id=2")
    assert.equal(await visible(inviteUid), 1)
    await db.query("UPDATE usuarios SET activo=false WHERE id=2")
    assert.equal(await visible(inviteUid), 0)
  })
})
