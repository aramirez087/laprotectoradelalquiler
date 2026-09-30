import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()

// Deliberately isolated: never loads environment files or a live DATABASE_URL.
test('user administration serializes changes, rejects stale forms and records private history', { timeout: 120_000 }, async (t) => {
  const container = `admin-users-test-${process.pid}-${Date.now()}`
  let db
  const clients = new Set()
  t.after(async () => {
    await Promise.all([...clients].map(client => client.end()))
    await db?.end()
    await docker('rm', '-f', container)
  })
  await docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', 'POSTGRES_DB=admin_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = Number((await docker('port', container, '5432')).split(':').pop())
  const connectionString = `postgres://postgres@127.0.0.1:${port}/admin_test`
  const deadline = Date.now() + 30_000
  while (!db) {
    const candidate = new pg.Client({ connectionString })
    try { await candidate.connect(); db = candidate }
    catch (error) {
      await candidate.end()
      if (Date.now() > deadline) throw error
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  const migration = await readFile('db/administrar-usuarios.sql', 'utf8')
  const schema = await readFile('schema.sql', 'utf8')
  assert.ok(schema.includes(migration), 'fresh installations include the exact additive migration')
  assert.ok(schema.endsWith(await readFile('db/sesiones-admin.sql', 'utf8')), 'fresh installations include the final session guards')
  await db.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY, user_id uuid, created_at timestamptz DEFAULT now());
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    GRANT SELECT ON auth.sessions TO service_role;`)
  await db.query(schema)
  await db.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;')
  await db.query(migration)

  async function connection() {
    const client = new pg.Client({ connectionString })
    clients.add(client)
    await client.connect()
    await client.query("SET ROLE service_role; SET statement_timeout='5s'")
    return client
  }
  async function seed() {
    await db.query(`RESET ROLE; RESET request.jwt.claim.role; RESET request.jwt.claim.sub;
      RESET request.jwt.claims; RESET request.jwt.claim.session_id;
      TRUNCATE public.usuarios, public.personas, auth.sessions RESTART IDENTITY CASCADE;
      INSERT INTO public.usuarios(email,nombre,rol,activo,identificacion,actualizado_en) VALUES
        ('admin-a@example.test','Admin A','admin',true,'100000001','2026-01-01T00:00:00.123456Z'),
        ('admin-b@example.test','Admin B','admin',true,'100000002','2026-01-01T00:00:00.123456Z'),
        ('owner@example.test','Owner','propietario',true,'100000003','2026-01-01T00:00:00.123456Z'),
        ('inactive@example.test','Inactive admin','admin',false,'100000004','2026-01-01T00:00:00.123456Z'),
        ('legacy@example.test','Legacy tenant','inquilino',true,'LEGACY-42','2026-01-01T00:00:00.123456Z');`)
  }
  const version = async (id, client = db) => (await client.query('SELECT actualizado_en::text AS version FROM public.usuarios WHERE id=$1', [id])).rows[0]?.version
  async function update({ actor = 1, id = 3, rol = 'agencia', activo = true, expected } = {}, client = db) {
    const previous = expected === undefined ? await version(id, client) : expected
    return (await client.query('SELECT id,nombre,actualizado_en::text FROM public.admin_actualizar_usuario($1,$2,$3,$4,$5)',
      [actor, id, rol, activo, previous])).rows[0]
  }
  async function profile({ actor = 1, id = 3, nombre = 'Updated Owner', identificacion = '100000003', telefono = '8888-8888', expected } = {}, client = db) {
    const previous = expected === undefined ? await version(id, client) : expected
    return (await client.query('SELECT id,nombre,actualizado_en::text FROM public.admin_actualizar_perfil_usuario($1,$2,$3,$4,$5,$6)',
      [actor, id, nombre, identificacion, telefono, previous])).rows[0]
  }
  const history = async (actor = 1, id = 3) => (await db.query('SELECT * FROM public.admin_historial_usuario($1,$2)', [actor, id])).rows

  await t.test('service role updates return the target identity and atomically record old and new permissions', async () => {
    await seed()
    const before = await version(3)
    await db.query('SET ROLE service_role')
    const result = await update()
    assert.equal(result.id, 3)
    assert.equal(result.nombre, 'Owner')
    assert.notEqual(result.actualizado_en, before)
    const [entry] = await history()
    assert.equal(entry.actor_nombre, 'Admin A')
    assert.equal(entry.usuario_nombre, 'Owner')
    assert.equal(entry.accion, 'permisos')
    assert.deepEqual(entry.antes, { rol: 'propietario', activo: true })
    assert.deepEqual(entry.despues, { rol: 'agencia', activo: true })
    await assert.rejects(db.query("UPDATE privado.administracion_usuarios_historial SET accion='forged'"), { code: '42501' })
    await assert.rejects(db.query('DELETE FROM privado.administracion_usuarios_historial'), { code: '42501' })
    await update({ rol: 'agencia' })
    assert.equal((await history()).length, 1, 'saving unchanged values does not create false history')
  })

  await t.test('stale forms cannot reactivate a suspension, including versions with microseconds', async () => {
    await seed()
    const initial = await version(3)
    await update({ rol: 'propietario', activo: false, expected: initial })
    await assert.rejects(update({ rol: 'agencia', activo: true, expected: initial }), /cambió desde/)
    await assert.rejects(update({ expected: null }), /cambió desde/)
    assert.deepEqual((await db.query('SELECT rol,activo FROM public.usuarios WHERE id=3')).rows[0], { rol: 'propietario', activo: false })
    assert.equal((await history()).length, 1)
  })

  await t.test('self removal and direct elevation are denied; an existing tenant role can be retained', async () => {
    await seed()
    await db.query("UPDATE public.usuarios SET activo=false WHERE id=2")
    await assert.rejects(update({ id: 1, rol: 'admin', activo: false }), /quitarse/)
    await assert.rejects(update({ id: 1, rol: 'propietario' }), /quitarse/)
    await assert.rejects(update({ rol: 'admin' }), /invitación de acceso/)
    await assert.rejects(update({ rol: 'inquilino' }), /rol histórico/)
    await assert.rejects(update({ rol: null }), /Revise los permisos/)
    await update({ id: 5, rol: 'inquilino', activo: false })
    assert.deepEqual((await db.query('SELECT rol,activo FROM public.usuarios WHERE id=5')).rows[0], { rol: 'inquilino', activo: false })
    assert.equal((await db.query("SELECT count(*)::int n FROM public.usuarios WHERE rol='admin' AND activo")).rows[0].n, 1)
  })

  await t.test('the actor is reauthorized after waiting for another administrator to commit', async () => {
    await seed()
    const [a, b] = await Promise.all([connection(), connection()])
    try {
      const [versionA, versionB] = await Promise.all([version(1), version(2)])
      await a.query('BEGIN')
      await update({ actor: 1, id: 2, rol: 'propietario', expected: versionB }, a)
      const pending = update({ actor: 2, id: 1, rol: 'propietario', expected: versionA }, b)
        .then(value => ({ value }), error => ({ error }))
      const limit = Date.now() + 2_000
      let blocked = false
      while (Date.now() < limit) {
        const status = (await db.query('SELECT wait_event FROM pg_stat_activity WHERE pid=$1', [b.processID])).rows[0]
        if (status?.wait_event === 'advisory') { blocked = true; break }
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      assert.ok(blocked, 'second edit waits on the shared transaction advisory lock')
      await a.query('COMMIT')
      const result = await pending
      assert.match(result.error?.message ?? '', /No puede administrar usuarios/)
      assert.equal((await db.query("SELECT count(*)::int n FROM public.usuarios WHERE rol='admin' AND activo")).rows[0].n, 1)
    } finally {
      await a.query('ROLLBACK')
      await Promise.all([a.end(), b.end()])
      clients.delete(a); clients.delete(b)
    }
  })

  await t.test('simultaneous edits with the same version produce one success and one conflict', async () => {
    await seed()
    const expected = await version(3)
    const [a, b] = await Promise.all([connection(), connection()])
    try {
      const results = await Promise.allSettled([
        update({ actor: 1, rol: 'agencia', expected }, a),
        update({ actor: 2, rol: 'propietario', activo: false, expected }, b),
      ])
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
      const rejected = results.find(result => result.status === 'rejected')
      assert.match(rejected.reason.message, /cambió desde/)
      assert.equal((await history()).length, 1)
    } finally {
      await Promise.all([a.end(), b.end()])
      clients.delete(a); clients.delete(b)
    }
  })

  await t.test('browser roles cannot invoke user RPCs or read or write private audit history', async () => {
    await seed()
    const expected = await version(3)
    for (const role of ['anon', 'authenticated']) {
      await db.query(`SET ROLE ${role}`)
      try {
        await assert.rejects(update({ expected }), { code: '42501' })
        await assert.rejects(profile({ expected }), { code: '42501' })
        await assert.rejects(history(), { code: '42501' })
        await assert.rejects(db.query('SELECT * FROM privado.administracion_usuarios_historial'), { code: '42501' })
        await assert.rejects(db.query("INSERT INTO privado.administracion_usuarios_historial(actor_nombre,usuario_nombre,accion) VALUES('Fake','Fake','permisos')"), { code: '42501' })
      } finally { await db.query('RESET ROLE') }
    }
    for (const actor of [3, 4, 999]) {
      await assert.rejects(update({ actor }), /No puede administrar usuarios/)
      await assert.rejects(profile({ actor }), /No puede administrar usuarios/)
      await assert.rejects(history(actor), /No puede administrar usuarios/)
    }
    await assert.rejects(update({ id: 999 }), /No encontramos esa cuenta/)
    await assert.rejects(profile({ id: 999 }), /No encontramos esa cuenta/)
  })

  await t.test('a failed audit insert rolls back the account mutation', async () => {
    await seed()
    const expected = await version(3)
    await db.query(`CREATE FUNCTION privado.fail_user_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced history failure'; END $$;
      CREATE TRIGGER fail_user_history BEFORE INSERT ON privado.administracion_usuarios_historial FOR EACH ROW EXECUTE FUNCTION privado.fail_user_history();`)
    try {
      await assert.rejects(update({ expected }), /forced history failure/)
      assert.equal(await version(3), expected)
      assert.equal((await db.query('SELECT rol FROM public.usuarios WHERE id=3')).rows[0].rol, 'propietario')
      assert.equal((await history()).length, 0)
    } finally {
      await db.query('DROP TRIGGER fail_user_history ON privado.administracion_usuarios_historial; DROP FUNCTION privado.fail_user_history()')
    }
  })

  await t.test('profile corrections are validated, versioned, audited and preserve account identity', async () => {
    await seed()
    const expected = await version(3)
    await db.query('SET ROLE service_role')
    const result = await profile({ nombre: '  Corrected Owner  ', identificacion: '1-7777-8888', telefono: '  8888-0000  ', expected })
    assert.equal(result.nombre, 'Corrected Owner')
    assert.deepEqual((await db.query('SELECT nombre,identificacion,telefono,email,rol,activo FROM public.usuarios WHERE id=3')).rows[0], {
      nombre: 'Corrected Owner', identificacion: '177778888', telefono: '8888-0000', email: 'owner@example.test', rol: 'propietario', activo: true,
    })
    const [entry] = await history()
    assert.equal(entry.accion, 'perfil')
    assert.deepEqual(entry.antes, { nombre: 'Owner', identificacion: '100000003', telefono: null })
    await assert.rejects(profile({ expected }), /cambió desde/)
    for (const nombre of ['', 'ab', 'a'.repeat(151)]) await assert.rejects(profile({ nombre }), /Revise el nombre/)
    await assert.rejects(profile({ telefono: '1'.repeat(31) }), /Revise el nombre/)
    await assert.rejects(profile({ identificacion: 'invalid' }), /6 a 12/)
    await assert.rejects(profile({ identificacion: '1-0000-0002' }), /otra cuenta/)
    await profile({ id: 5, identificacion: 'LEGACY-42', nombre: 'Corrected Legacy', telefono: '' })
    assert.equal((await db.query('SELECT identificacion FROM public.usuarios WHERE id=5')).rows[0].identificacion, 'LEGACY-42')
  })

  await t.test('revoked or forged sessions cannot inherit administrator or ordinary access through RLS', async () => {
    await seed()
    const authAdmin = 'a1111111-1111-4111-8111-111111111111'
    const authOwner = 'b2222222-2222-4222-8222-222222222222'
    const oldSession = 'c3333333-3333-4333-8333-333333333333'
    const acceptedSession = 'd4444444-4444-4444-8444-444444444444'
    const otherSession = 'e5555555-5555-4555-8555-555555555555'
    const oldOwnerSession = 'f6666666-6666-4666-8666-666666666666'
    await db.query('UPDATE public.usuarios SET auth_user_id=$1 WHERE id=1', [authAdmin])
    await db.query('UPDATE public.usuarios SET auth_user_id=$1 WHERE id=3', [authOwner])
    await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$3),($2,$3),($4,$5)', [oldSession, acceptedSession, authAdmin, otherSession, authOwner])
    await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)', [oldOwnerSession, authOwner])
    await db.query(`INSERT INTO public.personas(identificacion,nombre,apellido1) VALUES('102340567','Tenant','Test');
      INSERT INTO public.resenas(persona_id,autor_id,estado,comentario) VALUES(1,2,'publicada','Visible review');
      INSERT INTO public.calificaciones(valor,texto) VALUES(5,'Good');`)
    await db.query('SET ROLE service_role')
    const check = async (user, session) => (await db.query('SELECT public.sesion_administracion_vigente($1,$2) AS vigente', [user, session])).rows[0].vigente
    assert.equal(await check(authAdmin, acceptedSession), true)
    assert.equal(await check(authOwner, acceptedSession), false, 'session must belong to the claimed user')
    assert.equal(await check(authAdmin, null), false)
    await db.query('RESET ROLE')
    // Mirrors Supabase signOut(others): the previous JWT still names the old session,
    // but the server-side session no longer exists when the account is elevated.
    await db.query('DELETE FROM auth.sessions WHERE id=$1', [oldSession])

    async function browserSession(user, session) {
      await db.query('RESET ROLE')
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claims',$2,false)",
        [user, JSON.stringify({ sub: user, ...(session === null ? {} : { session_id: session }) })])
      await db.query('SET ROLE authenticated')
    }
    for (const session of [oldSession, otherSession, null, 'not-a-uuid']) {
      await browserSession(authAdmin, session)
      const access = (await db.query('SELECT * FROM public.mi_acceso_consulta()')).rows[0]
      assert.equal(access.puede_consultar, false)
      assert.equal(access.motivo, 'error')
      assert.equal((await db.query('SELECT id FROM public.personas')).rowCount, 0)
      assert.equal((await db.query('SELECT id FROM public.resenas')).rowCount, 0)
      assert.equal((await db.query('SELECT id FROM public.calificaciones')).rowCount, 0)
      assert.equal((await db.query('SELECT id FROM public.usuarios')).rowCount, 0)
      assert.equal((await db.query('SELECT public.mi_sesion_administracion_vigente() AS vigente')).rows[0].vigente, false)
      await assert.rejects(db.query("INSERT INTO public.resenas(persona_id,autor_id,estado,comentario) VALUES(1,1,'borrador','Revoked attempt')"), { code: '42501' })
      await assert.rejects(check(authAdmin, acceptedSession), { code: '42501' })
    }
    await browserSession(authAdmin, acceptedSession)
    assert.equal((await db.query('SELECT * FROM public.mi_acceso_consulta()')).rows[0].puede_consultar, true)
    assert.equal((await db.query('SELECT id FROM public.personas')).rowCount, 1)
    assert.equal((await db.query('SELECT id FROM public.resenas')).rowCount, 1)
    assert.equal((await db.query('SELECT id FROM public.calificaciones')).rowCount, 1)
    assert.equal((await db.query('SELECT public.mi_sesion_administracion_vigente() AS vigente')).rows[0].vigente, true)
    await db.query("INSERT INTO public.resenas(persona_id,autor_id,estado,comentario) VALUES(1,1,'borrador','Live session')")

    await db.query('RESET ROLE; RESET request.jwt.claim.role')
    await db.query("INSERT INTO public.resenas(persona_id,autor_id,estado,comentario) VALUES(1,3,'publicada','Ordinary owner review')")
    await db.query("INSERT INTO public.denuncias(resena_id,denunciante_id,motivo) VALUES(1,3,'otro')")
    await db.query('DELETE FROM auth.sessions WHERE id=$1', [oldOwnerSession])
    for (const session of [oldOwnerSession, acceptedSession, null, 'not-a-uuid']) {
      await browserSession(authOwner, session)
      const access = (await db.query('SELECT * FROM public.mi_acceso_consulta()')).rows[0]
      assert.equal(access.puede_consultar, false)
      assert.equal(access.motivo, 'error')
      for (const table of ['usuarios', 'personas', 'resenas', 'calificaciones', 'denuncias']) {
        assert.equal((await db.query(`SELECT id FROM public.${table}`)).rowCount, 0, `${table} denied to a revoked ordinary session`)
      }
      await assert.rejects(db.query("INSERT INTO public.resenas(persona_id,autor_id,estado,comentario) VALUES(1,3,'borrador','Revoked owner attempt')"), { code: '42501' })
    }
    await browserSession(authOwner, otherSession)
    assert.equal((await db.query('SELECT * FROM public.mi_acceso_consulta()')).rows[0].puede_consultar, true,
      'a current ordinary session preserves approved-owner access')
    assert.equal((await db.query('SELECT id FROM public.usuarios')).rowCount, 1)
    assert.equal((await db.query('SELECT id FROM public.personas')).rowCount, 1)
    assert.equal((await db.query('SELECT id FROM public.resenas')).rowCount, 2)
    assert.equal((await db.query('SELECT id FROM public.calificaciones')).rowCount, 1)
    assert.equal((await db.query('SELECT id FROM public.denuncias')).rowCount, 1)
  })

  await t.test('the additive migration can be reapplied without replacing existing accounts or history', async () => {
    await seed()
    await update()
    const before = await version(3)
    await db.query(migration)
    await db.query(migration)
    assert.equal(await version(3), before)
    assert.equal((await history()).length, 1)
    assert.equal((await db.query('SELECT count(*)::int n FROM public.usuarios')).rows[0].n, 5)
  })
})
