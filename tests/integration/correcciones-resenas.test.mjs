import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()

// Never reads .env or a live DATABASE_URL. The whole schema runs in disposable Postgres.
test('authorized review corrections preserve moderation, history and access credits', { timeout: 120_000 }, async t => {
  const container = `correcciones-test-${process.pid}-${Date.now()}`
  let db
  t.after(async () => { await db?.end(); await docker('rm', '-f', container) })
  await docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', 'POSTGRES_DB=correcciones_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = Number((await docker('port', container, '5432')).split(':').pop())
  const connectionString = `postgres://postgres@127.0.0.1:${port}/correcciones_test`
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
  await db.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;`)
  const schema = await readFile('schema.sql', 'utf8')
  const migration = await readFile('db/correcciones-resenas.sql', 'utf8')
  assert.ok(schema.includes(migration), 'fresh installs and upgrades use the same migration')
  await db.query(schema.slice(0, schema.lastIndexOf(migration)))
  await db.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;')

  const original = 'Pagó a tiempo y entregó la propiedad en buen estado.'
  const corrected = 'Pagó a tiempo; precisé los hechos y la entrega de la propiedad.'
  const seed = async () => {
    await db.query(`RESET ROLE; TRUNCATE usuarios, personas, resenas RESTART IDENTITY CASCADE;
      INSERT INTO usuarios(email,nombre,rol,activo) VALUES
        ('author@example.test','Author','propietario',true),
        ('admin@example.test','Admin','admin',true),
        ('other@example.test','Other','agencia',true),
        ('inactive@example.test','Inactive','propietario',false);
      INSERT INTO personas(identificacion,nombre,apellido1) VALUES ('102340567','Ana','Solís');`)
    await db.query('INSERT INTO resenas(persona_id,autor_id,comentario,anonima,estado) VALUES (1,1,$1,true,\'borrador\')', [original])
  }
  const review = async () => (await db.query('SELECT * FROM resenas WHERE id=1')).rows[0]
  const access = async () => (await db.query('SELECT * FROM accesos_consulta(ARRAY[1])')).rows[0]
  const requestCorrection = async () => db.query(`UPDATE resenas SET estado='oculta', permite_correccion=true,
    detalle_verificacion='Precise los hechos y retire datos personales.' WHERE id=1`)
  const correct = async ({ actor = 1, version = 2, comment = corrected, anonymous = false, client = db } = {}) =>
    client.query('SELECT * FROM corregir_resena($1,1,$2,$3,$4)', [actor, version, comment, anonymous])
  const asRole = async (role, fn) => {
    await db.query(`SET ROLE ${role}`)
    try { return await fn() } finally { await db.query('RESET ROLE') }
  }

  await t.test('populated upgrade is additive, repeatable and leaves old rejections final', async () => {
    await seed()
    await db.query("UPDATE resenas SET estado='oculta', detalle_verificacion='Original rejection'")
    const before = await review()
    await db.query(migration)
    const after = await review()
    assert.equal(after.id, before.id)
    assert.equal(after.comentario, original)
    assert.equal(after.creado_en.toISOString(), before.creado_en.toISOString())
    assert.equal(after.permite_correccion, false)
    assert.equal(after.version, 1)
    await db.query(migration)
    assert.deepEqual(await review(), after)
  })

  await t.test('a correction changes the same review, archives old text and waits for first approval', async () => {
    await seed()
    const before = await review()
    await requestCorrection()
    assert.equal((await access()).puede_consultar, false)
    await asRole('service_role', () => correct())
    const after = await review()
    assert.equal(after.id, before.id)
    assert.equal(after.persona_id, before.persona_id)
    assert.equal(after.autor_id, before.autor_id)
    assert.equal(after.creado_en.toISOString(), before.creado_en.toISOString())
    assert.equal(after.comentario, corrected)
    assert.equal(after.anonima, false)
    assert.equal(after.estado, 'borrador')
    assert.equal(after.permite_correccion, false)
    assert.equal(after.verificada, false)
    assert.equal(after.version, 3)
    assert.equal(after.primera_aprobacion_en, null)
    assert.equal((await access()).puede_consultar, false)
    assert.equal((await db.query('SELECT count(*)::int n FROM resenas')).rows[0].n, 1)
    const history = (await db.query('SELECT * FROM historial_resenas(1,ARRAY[1])')).rows
    assert.equal(history.length, 2)
    assert.equal(history[0].comentario, original)
    assert.equal(history[0].permite_correccion, true)
    assert.equal(history[0].detalle_verificacion, after.detalle_verificacion)
    await db.query("UPDATE resenas SET estado='publicada', permite_correccion=false WHERE id=1")
    assert.equal((await access()).puede_consultar, true)
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.aportes_consulta')).rows[0].n, 1)
  })

  await t.test('final, pending, published, inactive and foreign reviews reject forged submissions', async () => {
    await seed()
    for (const estado of ['borrador', 'publicada', 'oculta']) {
      await db.query('UPDATE resenas SET estado=$1, permite_correccion=false WHERE id=1', [estado])
      const current = await review()
      await assert.rejects(correct({ version: current.version }), /no admite correcciones/)
      assert.deepEqual(await review(), current)
    }
    await requestCorrection()
    for (const actor of [3, 4, 999]) await assert.rejects(correct({ actor, version: (await review()).version }), /en su cuenta|inactiva/)
    await db.query('UPDATE usuarios SET activo=false WHERE id=1')
    await assert.rejects(correct({ version: (await review()).version }), /inactiva/)
  })

  await t.test('invalid or unchanged input and duplicate submissions leave no partial history', async () => {
    await seed(); await requestCorrection()
    const before = await review()
    for (const comment of [null, 'short', 'x'.repeat(5001)]) await assert.rejects(correct({ comment }), /entre 30 y 5000/)
    await assert.rejects(correct({ comment: `  ${original}  `, anonymous: true }), /antes de reenviar/)
    assert.deepEqual(await review(), before)
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.historial_resenas')).rows[0].n, 1)
    await db.query("ALTER TABLE resenas ADD CONSTRAINT correction_failure CHECK (comentario <> 'Relato corregido que debe fallar al final de la escritura.')")
    await assert.rejects(correct({ comment: 'Relato corregido que debe fallar al final de la escritura.' }), /correction_failure/)
    assert.deepEqual(await review(), before)
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.historial_resenas')).rows[0].n, 1)
    await db.query('ALTER TABLE resenas DROP CONSTRAINT correction_failure')
    await correct()
    const saved = await review()
    await assert.rejects(correct(), /cambió desde/)
    assert.deepEqual(await review(), saved)
    await assert.rejects(db.query('INSERT INTO resenas(persona_id,autor_id,comentario) VALUES(1,1,$1)', [original]), /resenas_autor_persona_unica/)
  })

  await t.test('previous approval and its immutable credit never restart on correction and reapproval', async () => {
    await seed()
    await db.query("UPDATE resenas SET estado='publicada'")
    const before = await review(), credit = await access()
    await requestCorrection()
    assert.equal((await access()).puede_consultar, false)
    await correct({ version: (await review()).version })
    assert.equal((await access()).puede_consultar, false)
    await db.query("UPDATE resenas SET estado='publicada', permite_correccion=false")
    assert.equal((await review()).primera_aprobacion_en.toISOString(), before.primera_aprobacion_en.toISOString())
    assert.equal((await access()).vence_en.toISOString(), credit.vence_en.toISOString())
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.aportes_consulta')).rows[0].n, 1)
  })

  await t.test('concurrent correction requests produce one saved version', async () => {
    await seed(); await requestCorrection()
    const other = new pg.Client({ connectionString })
    await other.connect()
    try {
      const results = await Promise.allSettled([correct(), correct({ client: other, comment: `${corrected} Otra versión.` })])
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
      assert.match(results.find(r => r.status === 'rejected').reason.message, /cambió desde/)
      assert.equal((await review()).version, 3)
      assert.equal((await db.query('SELECT count(*)::int n FROM privado.historial_resenas')).rows[0].n, 2)
    } finally { await other.end() }
  })

  await t.test('stale admin approvals and edits cannot overwrite corrected text', async () => {
    await seed(); await requestCorrection(); await correct()
    const saved = await review()
    const approval = await db.query("UPDATE resenas SET estado='publicada', permite_correccion=false WHERE id=1 AND version=2 RETURNING id")
    assert.equal(approval.rowCount, 0)
    await assert.rejects(db.query("SELECT * FROM admin_editar_resena_versionada(2,1,'102340567','Ana','','Solís','',$1,true,2)", [original]), /cambió desde/)
    assert.deepEqual(await review(), saved)
    await asRole('service_role', () => db.query("SELECT * FROM admin_editar_resena_versionada(2,1,'102340567','Ana','','Solís','',$1,true,3)", [corrected]))
    assert.equal((await review()).version, 4)
  })

  await t.test('browser roles cannot call privileged operations or read private versions', async () => {
    await seed(); await requestCorrection()
    for (const role of ['anon', 'authenticated']) await asRole(role, async () => {
      await assert.rejects(correct(), /permission denied for function/)
      await assert.rejects(db.query('SELECT * FROM historial_resenas(2,ARRAY[1])'), /permission denied for function/)
      await assert.rejects(db.query('SELECT * FROM privado.historial_resenas'), /permission denied/)
      await assert.rejects(db.query('UPDATE resenas SET permite_correccion=true WHERE id=1'), /permission denied/)
    })
    await asRole('service_role', async () => {
      assert.equal((await db.query('SELECT * FROM historial_resenas(1,ARRAY[1])')).rowCount, 1)
      assert.equal((await db.query('SELECT * FROM historial_resenas(2,ARRAY[1])')).rowCount, 1)
      for (const actor of [3,4,999]) assert.equal((await db.query('SELECT * FROM historial_resenas($1,ARRAY[1])', [actor])).rowCount, 0)
    })
  })

  await t.test('moderation instructions are required and private history follows review deletion', async () => {
    await seed()
    await assert.rejects(db.query("UPDATE resenas SET estado='oculta', permite_correccion=true, detalle_verificacion=''"), /resenas_correccion_autorizada/)
    await requestCorrection()
    await db.query('DELETE FROM resenas WHERE id=1')
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.historial_resenas')).rows[0].n, 0)
  })
})
