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
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY, user_id uuid NOT NULL);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;`)
  await db.query(schema)
  // Supabase grants these service-role privileges by default.
  await db.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;')
  await db.query(migration)
  const uid = 'a1111111-1111-4111-8111-111111111111'
  const inviteUid = 'b2222222-2222-4222-8222-222222222222'
  const inviteId = 'c3333333-3333-4333-8333-333333333333'
  const sessionId = 'd4444444-4444-4444-8444-444444444444'
  const adminSessionId = 'e5555555-5555-4555-8555-555555555555'
  const seed = async () => {
    await db.query(`RESET ROLE; RESET request.jwt.claim.role; RESET request.jwt.claim.sub;
      RESET request.jwt.claim.session_id; RESET request.jwt.claims;
      TRUNCATE usuarios, personas, resenas, invitaciones_admin, auth.sessions, privado.invitaciones_admin_emisiones RESTART IDENTITY CASCADE;
      INSERT INTO usuarios (nombre,email,rol,auth_user_id) VALUES ('Admin','admin@example.test','admin','${uid}');
      INSERT INTO auth.sessions(id,user_id) VALUES ('${sessionId}','${inviteUid}'), ('${adminSessionId}','${uid}');
      INSERT INTO invitaciones_admin(id,email,nombre,auth_user_id,invitado_por,token_digest,tipo,vence_en)
        VALUES ('${inviteId}','invited@example.test','Invited Admin','${inviteUid}',1,'digest','invite',now()+interval '1 hour');`)
  }
  const accept = (authId = inviteUid, token = 'digest', session = sessionId) => db.query('SELECT aceptar_invitacion_admin($1,$2,$3,$4)', [inviteId, authId, token, session])
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
  await t.test('an untargeted invitation cannot promote or reactivate an existing account', async () => {
    await seed()
    await db.query("INSERT INTO usuarios(nombre,email,rol,activo,auth_user_id) VALUES ('Existing','invited@example.test','propietario',false,$1)", [inviteUid])
    await assert.rejects(accept())
    assert.deepEqual((await db.query('SELECT rol,activo FROM usuarios WHERE auth_user_id=$1', [inviteUid])).rows[0], { rol: 'propietario', activo: false })
  })
  await t.test('a targeted verified invitation elevates the existing profile and records before/after history', async () => {
    await seed()
    await db.query("INSERT INTO usuarios(nombre,email,rol,auth_user_id) VALUES ('Existing owner','invited@example.test','propietario',$1)", [inviteUid])
    await db.query('UPDATE invitaciones_admin SET target_usuario_id=2,target_version=(SELECT actualizado_en FROM usuarios WHERE id=2)')
    await db.query('SET ROLE service_role')
    await accept()
    await db.query('RESET ROLE')
    assert.equal((await db.query('SELECT count(*)::int AS n FROM usuarios')).rows[0].n, 2)
    const user = (await db.query('SELECT id,nombre,rol,activo FROM usuarios WHERE id=2')).rows[0]
    assert.deepEqual(user, { id: 2, nombre: 'Existing owner', rol: 'admin', activo: true })
    const audit = (await db.query('SELECT accion,antes,despues,actor_nombre,usuario_nombre FROM privado.administracion_usuarios_historial')).rows[0]
    assert.equal(audit.accion, 'elevacion_admin')
    assert.equal(audit.antes.rol, 'propietario')
    assert.equal(audit.despues.rol, 'admin')
    assert.equal(audit.actor_nombre, 'Admin')
    assert.equal(audit.usuario_nombre, 'Existing owner')
  })
  await t.test('login activation binds an imported profile without changing its legacy role, activity or author identity', async () => {
    await seed()
    await db.query("INSERT INTO usuarios(nombre,email,rol,activo) VALUES ('Existing tenant','invited@example.test','inquilino',true)")
    await db.query("UPDATE invitaciones_admin SET proposito='acceso',target_usuario_id=2,target_version=(SELECT actualizado_en FROM usuarios WHERE id=2)")
    await accept()
    assert.deepEqual((await db.query('SELECT id,nombre,rol,activo,auth_user_id FROM usuarios WHERE id=2')).rows[0],
      { id: 2, nombre: 'Existing tenant', rol: 'inquilino', activo: true, auth_user_id: inviteUid })
    assert.equal((await db.query('SELECT accion FROM privado.administracion_usuarios_historial')).rows[0].accion, 'activacion_login')
  })
  await t.test('changed versions, identities and inactive profiles cannot accept stale invitations', async () => {
    for (const mutation of [
      "UPDATE usuarios SET actualizado_en=actualizado_en+interval '1 microsecond' WHERE id=2",
      'UPDATE usuarios SET activo=false WHERE id=2',
      "UPDATE usuarios SET email='other@example.test' WHERE id=2",
      "UPDATE usuarios SET auth_user_id='f6666666-6666-4666-8666-666666666666' WHERE id=2",
      "UPDATE usuarios SET rol='admin' WHERE id=2",
      'DELETE FROM usuarios WHERE id=2',
    ]) {
      await seed()
      await db.query("INSERT INTO usuarios(nombre,email,rol) VALUES ('Existing owner','invited@example.test','propietario')")
      await db.query('UPDATE invitaciones_admin SET target_usuario_id=2,target_version=(SELECT actualizado_en FROM usuarios WHERE id=2)')
      await db.query(mutation)
      await assert.rejects(accept())
      assert.equal((await db.query('SELECT aceptada_en FROM invitaciones_admin')).rows[0].aceptada_en, null)
      assert.equal((await db.query('SELECT count(*)::int n FROM privado.administracion_usuarios_historial')).rows[0].n, 0)
    }
  })
  await t.test('acceptance requires the verified live session belonging to the invited Auth identity', async () => {
    await seed()
    await assert.rejects(accept(inviteUid, 'digest', null))
    await assert.rejects(accept(inviteUid, 'digest', adminSessionId))
    await db.query('DELETE FROM auth.sessions WHERE id=$1', [sessionId])
    await assert.rejects(accept())
    assert.equal((await db.query('SELECT count(*)::int n FROM usuarios')).rows[0].n, 1)
    assert.equal((await db.query("SELECT to_regprocedure('public.aceptar_invitacion_admin(uuid,uuid,text)') old")).rows[0].old, null)
  })
  await t.test('cancellation is idempotent, audited, and prevents subsequent acceptance', async () => {
    await seed()
    await db.query('SELECT cancelar_invitacion_admin($1,$2)', [1, inviteId])
    await db.query('SELECT cancelar_invitacion_admin($1,$2)', [1, inviteId])
    await assert.rejects(accept())
    assert.ok((await db.query('SELECT revocada_en FROM invitaciones_admin')).rows[0].revocada_en)
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.administracion_usuarios_historial')).rows[0].n, 1)
    await seed()
    await accept()
    await assert.rejects(db.query('SELECT cancelar_invitacion_admin($1,$2)', [1, inviteId]), /ya fue aceptada/)
  })
  await t.test('renewal preserves old records, revokes previous links and checks the actor and expected target version', async () => {
    await seed()
    const nextId = 'f6666666-6666-4666-8666-666666666666'
    const reserve = () => db.query("SELECT reservar_emision_invitacion_admin(1,'invited@example.test',$1)", [nextId])
    const register = async () => {
      await reserve()
      return db.query(`SELECT registrar_invitacion_admin($1,1,'invited@example.test','New invitation',$2,$3,'invite',now()+interval '1 hour','administracion',null,null)`, [nextId, inviteUid, 'd'.repeat(64)])
    }
    await register()
    assert.equal((await db.query('SELECT count(*)::int n FROM invitaciones_admin')).rows[0].n, 2)
    assert.ok((await db.query('SELECT revocada_en FROM invitaciones_admin WHERE id=$1', [inviteId])).rows[0].revocada_en)
    await assert.rejects(accept())
    await db.query('SELECT aceptar_invitacion_admin($1,$2,$3,$4)', [nextId, inviteUid, 'd'.repeat(64), sessionId])
    assert.equal((await db.query("SELECT count(*)::int n FROM privado.administracion_usuarios_historial WHERE accion='invitacion_renovada'")).rows[0].n, 1)
    await seed()
    await db.query("UPDATE usuarios SET rol='propietario' WHERE id=1")
    await assert.rejects(register(), /administración activa/)
    await seed()
    await db.query("INSERT INTO usuarios(nombre,email,rol) VALUES ('Existing','invited@example.test','propietario')")
    await reserve()
    await assert.rejects(db.query(`SELECT registrar_invitacion_admin($1,1,'invited@example.test','New invitation',$2,$3,'invite',now()+interval '1 hour','administracion',2,'2020-01-01')`, [nextId, inviteUid, 'd'.repeat(64)]), /cuenta cambió/)
  })
  await t.test('generation leases prevent overlapping Auth issuance and reject a stale request after recovery', async () => {
    await seed()
    const first = 'f6666666-6666-4666-8666-666666666666'
    const second = 'a7777777-7777-4777-8777-777777777777'
    const reserve = id => db.query("SELECT reservar_emision_invitacion_admin(1,'invited@example.test',$1)", [id])
    const register = id => db.query(`SELECT registrar_invitacion_admin($1,1,'invited@example.test','New invitation',$2,$3,'invite',now()+interval '1 hour','administracion',null,null)`, [id, inviteUid, 'd'.repeat(64)])
    await reserve(first)
    await assert.rejects(reserve(second), /se está generando/)
    await db.query('SELECT liberar_emision_invitacion_admin($1)', [second])
    await assert.rejects(reserve(second), /se está generando/)
    await db.query("UPDATE privado.invitaciones_admin_emisiones SET vence_en=now()-interval '1 second'")
    await reserve(second)
    await assert.rejects(register(first), /emisión venció/)
    await db.query('SELECT liberar_emision_invitacion_admin($1)', [first])
    await register(second)
    assert.equal((await db.query('SELECT id FROM invitaciones_admin WHERE revocada_en IS NULL')).rows[0].id, second)
    await db.query('SELECT liberar_emision_invitacion_admin($1)', [second])
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.invitaciones_admin_emisiones')).rows[0].n, 0)
  })
  await t.test('literal email equality does not confuse underscores or percentages with wildcards', async () => {
    await seed()
    await db.query("INSERT INTO usuarios(nombre,email) VALUES ('Other','axb@example.test'),('Actual','a_b@example.test'),('Percent','a%b@example.test')")
    assert.deepEqual((await db.query("SELECT email FROM cuenta_para_invitacion_admin(1,'A_B@example.test')")).rows, [{ email: 'a_b@example.test' }])
    assert.deepEqual((await db.query("SELECT email FROM cuenta_para_invitacion_admin(1,'a%b@example.test')")).rows, [{ email: 'a%b@example.test' }])
    assert.deepEqual((await db.query("SELECT email FROM cuenta_para_invitacion_admin(1,'a__b@example.test')")).rows, [])
  })
  await t.test('revocation and acceptance serialize against the same advisory lock', async () => {
    await seed()
    const contender = new pg.Client({ connectionString })
    await contender.connect()
    try {
      await db.query("BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('administracion_usuarios',0))")
      const result = contender.query('SELECT aceptar_invitacion_admin($1,$2,$3,$4)', [inviteId, inviteUid, 'digest', sessionId]).then(() => null, error => error)
      await db.query('SELECT cancelar_invitacion_admin($1,$2)', [1, inviteId])
      await db.query('COMMIT')
      assert.match((await result).message, /Invitación no disponible/)
      assert.equal((await db.query('SELECT count(*)::int n FROM usuarios')).rows[0].n, 1)
    } finally {
      await db.query('ROLLBACK')
      await contender.end()
    }
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
      await assert.rejects(db.query('SELECT cancelar_invitacion_admin($1,$2)', [1, inviteId]), { code: '42501' })
      await assert.rejects(db.query("SELECT * FROM cuenta_para_invitacion_admin(1,'invited@example.test')"), { code: '42501' })
      await assert.rejects(db.query("SELECT reservar_emision_invitacion_admin(1,'invited@example.test',$1)", [inviteId]), { code: '42501' })
      await assert.rejects(db.query('SELECT liberar_emision_invitacion_admin($1)', [inviteId]), { code: '42501' })
      await db.query('RESET ROLE')
    }
  })
  await t.test('live RLS rules deny ordinary users without approved reviews and prevent self-promotion', async () => {
    await seed()
    await db.query(`INSERT INTO usuarios(nombre,email,rol,auth_user_id) VALUES ('Ordinary','ordinary@example.test','propietario','${inviteUid}');
      INSERT INTO personas(identificacion,nombre,apellido1) VALUES ('102340567','Tenant','Test');
      INSERT INTO resenas(persona_id,autor_id,comentario,estado) VALUES (1,1,'Admin review','publicada');`)
    async function visible(authId) {
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.session_id',$2,false)", [authId, authId === uid ? adminSessionId : sessionId])
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
