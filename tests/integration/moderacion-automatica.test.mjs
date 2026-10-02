import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()

// No .env, live connection string or real reviews are read by this test.
test('automatic moderation fails closed and publishes one reviewed version atomically', { timeout: 120_000 }, async t => {
  const container = `moderacion-test-${process.pid}-${Date.now()}`
  let db
  t.after(async () => { await db?.end(); await docker('rm', '-f', container) })
  await docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', 'POSTGRES_DB=moderacion_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = Number((await docker('port', container, '5432')).split(':').pop())
  const connectionString = `postgres://postgres@127.0.0.1:${port}/moderacion_test`
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
  const migration = await readFile('db/moderacion-automatica.sql', 'utf8')
  assert.ok(schema.includes(migration), 'fresh installs include the identical additive migration')
  await db.query(schema.slice(0, schema.lastIndexOf(migration)))
  await db.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;')

  const comment = 'Pagó a tiempo y entregó la propiedad en buen estado.'
  let featureInstalled = false
  const safe = { decision: 'segura', motivo: 'contenido_seguro', modelo: 'openai/gpt-oss-120b', politica: 'resenas-v1', categorias: [] }
  const review = async () => (await db.query('SELECT * FROM resenas WHERE id=1')).rows[0]
  const audits = async () => (await db.query('SELECT * FROM privado.moderacion_automatica_resenas ORDER BY version_evaluada')).rows
  const asRole = async (role, fn) => {
    await db.query(`SET ROLE ${role}`)
    try { return await fn() } finally { await db.query('RESET ROLE') }
  }
  const resolve = async (overrides = {}) => {
    const p = { id: 1, version: 1, comment, damage: null, author: '101230456', tenant: '102340567', result: safe, client: db, ...overrides }
    return (await p.client.query('SELECT * FROM resolver_moderacion_automatica_resena($1,$2,$3,$4,$5,$6,$7::jsonb)',
      [p.id, p.version, p.comment, p.damage, p.author, p.tenant, JSON.stringify(p.result)])).rows[0]
  }
  const claim = async (id = 1, version = 1, client = db) =>
    (await client.query('SELECT consumir_cupo_moderacion_resena($1,$2) AS ok', [id, version])).rows[0].ok
  const createReviews = async (author, count) => (await db.query(`
    WITH people AS (
      INSERT INTO personas(identificacion,nombre,apellido1)
        SELECT (900000000+$1::integer*1000+i)::text,'Persona','Prueba' FROM generate_series(1,$2::integer) i RETURNING id
    ) INSERT INTO resenas(persona_id,autor_id,comentario,estado)
      SELECT id,$1,$3,'borrador' FROM people RETURNING id`, [author, count, comment])).rows.map(r => r.id)
  const concurrentClaims = async ids => {
    const clients = ids.map(() => new pg.Client({ connectionString }))
    try {
      return await Promise.all(clients.map(async (client, i) => {
        await client.connect(); await client.query('SET ROLE service_role')
        return claim(ids[i], 1, client)
      }))
    } finally { await Promise.all(clients.map(client => client.end())) }
  }
  const seed = async () => {
    await db.query(`RESET ROLE; TRUNCATE usuarios, personas, resenas, padron_tse, verificaciones_cedula RESTART IDENTITY CASCADE;
      INSERT INTO usuarios(email,nombre,rol,identificacion,activo,auth_user_id) VALUES
        ('author@example.test','Author','propietario','1-0123-0456',true,'00000000-0000-0000-0000-000000000001'),
        ('admin@example.test','Admin','admin',NULL,true,NULL),
        ('inactive@example.test','Inactive','admin',NULL,false,NULL);
      INSERT INTO personas(identificacion,nombre,apellido1) VALUES ('1-0234-0567','Ana','Solís');
      INSERT INTO padron_tse(id,version,fecha_padron,prefijos,registros,sha256)
        VALUES(1,current_date::text||'-aaaaaaaaaaaaaaaa',current_date,ARRAY['101','102'],3000000,repeat('a',64));
      INSERT INTO verificaciones_cedula(identificacion,estado,fecha_padron,nombre_tse) VALUES
        ('101230456','encontrada',current_date,'Author Test'),
        ('102340567','encontrada',current_date,'ANA SOLIS');`)
    await db.query("INSERT INTO resenas(persona_id,autor_id,comentario,estado) VALUES(1,1,$1,'borrador')", [comment])
    if (featureInstalled) {
      await db.query(`SELECT guardar_verificacion_cedula(identificacion,fecha_padron,nombre_tse,
        (SELECT version FROM padron_tse WHERE id=1)) FROM verificaciones_cedula`)
    }
  }

  await t.test('populated upgrades preserve existing states and can be repeated', async () => {
    await seed()
    await db.query("UPDATE resenas SET estado='oculta', detalle_verificacion='Human decision'")
    const before = await review()
    await db.query(migration)
    featureInstalled = true
    assert.deepEqual(await review(), before)
    await db.query(migration)
    assert.deepEqual(await review(), before)
    assert.deepEqual(await audits(), [])
  })

  await t.test('safe current content and both verified identities publish with ordinary approval effects', async () => {
    await seed()
    const result = await asRole('service_role', () => resolve())
    assert.deepEqual(result, { publicada: true, motivo: 'contenido_seguro', version: 2 })
    const saved = await review(), [audit] = await audits()
    assert.equal(saved.estado, 'publicada')
    assert.equal(saved.verificada, false, 'publication is not verification of the reported facts')
    assert.ok(saved.primera_aprobacion_en)
    assert.equal(audit.decision, 'aprobada')
    assert.equal(audit.version_evaluada, 1)
    assert.equal(audit.version_resultante, 2)
    assert.match(audit.contenido_sha256, /^[a-f0-9]{64}$/)
    assert.equal(JSON.stringify(audit).includes(comment), false)
    assert.equal(JSON.stringify(audit).includes('101230456'), false)
    assert.equal(JSON.stringify(audit).includes('102340567'), false)
    for (const table of ['historial_resenas', 'aportes_consulta', 'avisos_moderacion']) {
      assert.equal((await db.query(`SELECT count(*)::int n FROM privado.${table}`)).rows[0].n, 1)
    }
    assert.equal((await db.query('SELECT accion FROM privado.avisos_moderacion')).rows[0].accion, 'aprobada')
    assert.equal((await db.query('SELECT puede_consultar FROM accesos_consulta(ARRAY[1])')).rows[0].puede_consultar, true)
  })

  await t.test('NSFW, outages, disabled classification and malformed responses defer without rejecting', async () => {
    const cases = [
      { ...safe, decision: 'revision', motivo: 'contenido_sensible', categorias: ['sexual_explicito'] },
      { ...safe, decision: 'revision', motivo: 'moderacion_no_disponible', modelo: null },
      { ...safe, decision: 'revision', motivo: 'moderacion_desactivada', modelo: null },
      { ...safe, modelo: null },
      { ...safe, modelo: 'unapproved-or-deprecated-model' },
      { ...safe, categorias: ['sexual_explicito'] },
      { ...safe, categorias: ['unknown_category'] },
      { ...safe, categorias: ['sexual_explicito', 'sexual_explicito'] },
      { ...safe, categorias: [12] },
      { ...safe, politica: 'future-policy' },
      { ...safe, motivo: 'unvalidated prompt text' },
      { ...safe, categorias: {} },
      null,
    ]
    for (const result of cases) {
      await seed()
      const response = await resolve({ result })
      assert.equal(response.publicada, false)
      assert.equal((await review()).estado, 'borrador')
      assert.equal((await review()).version, 1)
      assert.equal((await audits())[0].decision, 'revision')
      assert.equal((await db.query('SELECT count(*)::int n FROM privado.avisos_moderacion')).rows[0].n, 0)
    }
  })

  await t.test('two safe reviews by one author publish concurrently without duplicating their individual effects', async () => {
    await seed()
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.activacion_cuentas WHERE usuario_id=1')).rows[0].n, 1,
      'the real activation row must exist to exercise its concurrent updates')
    await db.query(`INSERT INTO personas(identificacion,nombre,apellido1) VALUES('202340567','Beatriz','Vargas');
      INSERT INTO verificaciones_cedula(identificacion,estado,fecha_padron,nombre_tse)
        VALUES('202340567','encontrada',current_date,'BEATRIZ VARGAS');`)
    await db.query("SELECT guardar_verificacion_cedula('202340567',current_date,'BEATRIZ VARGAS',(SELECT version FROM padron_tse WHERE id=1))")
    await db.query("INSERT INTO resenas(persona_id,autor_id,comentario,estado) VALUES(2,1,$1,'borrador')", [comment])
    const other = new pg.Client({ connectionString })
    await other.connect()
    try {
      await other.query('SET ROLE service_role')
      const responses = await Promise.all([
        asRole('service_role', () => resolve()),
        resolve({ id: 2, tenant: '202340567', client: other }),
      ])
      assert.equal(responses.every(r => r.publicada && r.version === 2), true)
      for (const table of ['moderacion_automatica_resenas', 'historial_resenas', 'aportes_consulta', 'avisos_moderacion']) {
        assert.equal((await db.query(`SELECT count(*)::int n FROM privado.${table}`)).rows[0].n, 2)
      }
    } finally { await other.end() }
  })

  await t.test('a safe answer from any other model cannot authorize publication', async () => {
    await seed()
    assert.deepEqual(await resolve({ result: { ...safe, modelo: 'other-provider/model' } }),
      { publicada: false, motivo: 'resultado_invalido', version: 1 })
    assert.equal((await audits())[0].decision, 'revision')
    assert.equal((await review()).estado, 'borrador')
  })

  await t.test('author and tenant IDs must both be found in the current, fresh official index', async () => {
    const invalidations = [
      "UPDATE usuarios SET identificacion='DIMEX-123456789' WHERE id=1",
      "UPDATE personas SET identificacion='LEGACY-102340567' WHERE id=1",
      "DELETE FROM verificaciones_cedula WHERE identificacion='101230456'",
      "DELETE FROM verificaciones_cedula WHERE identificacion='102340567'",
      "UPDATE verificaciones_cedula SET estado='no_encontrada',nombre_tse=NULL WHERE identificacion='101230456'",
      "UPDATE verificaciones_cedula SET fecha_padron=current_date-1,version_padron=NULL",
      "UPDATE padron_tse SET fecha_padron=current_date-63",
      "UPDATE padron_tse SET fecha_padron=current_date+1",
      'DELETE FROM padron_tse',
    ]
    for (const invalidate of invalidations) {
      await seed(); await db.query(invalidate)
      const response = await resolve()
      assert.equal(response.publicada, false, invalidate)
      assert.equal((await review()).estado, 'borrador')
      assert.equal((await audits())[0].decision, 'revision')
    }
  })

  await t.test('identity or name edits during AI evaluation cannot publish mismatched tenants', async () => {
    await seed()
    await db.query("UPDATE personas SET identificacion='202340567'")
    assert.equal((await resolve()).motivo, 'identidad_cambio')
    assert.equal((await review()).version, 1)
    await seed()
    await db.query("UPDATE personas SET nombre='Otra persona'")
    assert.equal((await resolve()).motivo, 'nombre_inquilino_no_coincide')
    await seed()
    await db.query('UPDATE usuarios SET activo=false WHERE id=1')
    assert.equal((await resolve()).motivo, 'autor_inactivo')
  })

  await t.test('a replacement manifest on the same date invalidates older proofs and late writes', async () => {
    await seed()
    const original = (await db.query('SELECT version FROM padron_tse')).rows[0].version
    await db.query("UPDATE padron_tse SET version=current_date::text||'-bbbbbbbbbbbbbbbb'")
    const replacement = (await db.query('SELECT version FROM padron_tse')).rows[0].version
    await asRole('service_role', async () => {
      await db.query("SELECT guardar_verificacion_cedula('102340567',current_date,'STALE WRONG NAME',$1)", [original])
      await db.query("SELECT guardar_verificacion_cedula('102340567',current_date,'LEGACY WRONG NAME')")
    })
    let proof = (await db.query("SELECT * FROM verificaciones_cedula WHERE identificacion='102340567'")).rows[0]
    assert.equal(proof.nombre_tse, 'ANA SOLIS')
    assert.equal(proof.version_padron, original)
    assert.equal((await resolve()).motivo, 'cedula_no_verificada')
    await seed()
    await db.query("UPDATE padron_tse SET version=current_date::text||'-bbbbbbbbbbbbbbbb'")
    await asRole('service_role', async () => {
      await db.query("SELECT guardar_verificacion_cedula('102340567',current_date,'ANA SOLIS',$1)", [replacement])
      await db.query("SELECT guardar_verificacion_cedula('101230456',current_date,'Author Test',$1)", [replacement])
      await db.query("SELECT guardar_verificacion_cedula('102340567',current_date,'STALE WRONG NAME',$1)", [original])
      await db.query("SELECT guardar_verificacion_cedula('102340567',current_date,'LEGACY WRONG NAME')")
    })
    proof = (await db.query("SELECT * FROM verificaciones_cedula WHERE identificacion='102340567'")).rows[0]
    assert.equal(proof.nombre_tse, 'ANA SOLIS')
    assert.equal(proof.version_padron, replacement)
    assert.equal((await resolve()).publicada, true)
    assert.equal((await audits())[0].version_padron, replacement)
  })

  await t.test('legacy unversioned proofs cannot authorize publication', async () => {
    await seed()
    await db.query('UPDATE verificaciones_cedula SET version_padron=NULL')
    assert.equal((await resolve()).motivo, 'cedula_no_verificada')
    assert.equal((await review()).estado, 'borrador')
  })

  await t.test('paid calls are claimed once per draft version and require an active author', async () => {
    await seed()
    assert.equal(await asRole('service_role', () => claim()), true)
    assert.equal(await claim(), false)
    assert.equal(await claim(1, 2), false)
    assert.equal(await claim(999), false)
    await seed(); await db.query('UPDATE usuarios SET activo=false WHERE id=1')
    assert.equal(await claim(), false)
    await seed(); await db.query("UPDATE resenas SET estado='oculta'")
    assert.equal(await claim(1, 2), false)
    await seed(); await resolve()
    assert.equal(await claim(1, 1), false)
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.intentos_moderacion_resenas')).rows[0].n, 0)
  })

  await t.test('overlapping requests cannot exceed five paid calls per author or ten globally', async () => {
    await seed()
    const own = await createReviews(1, 12)
    assert.equal((await concurrentClaims(own)).filter(Boolean).length, 5)
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.intentos_moderacion_resenas')).rows[0].n, 5)
    await seed()
    const authors = [1, ...(await db.query(`INSERT INTO usuarios(email,nombre,rol,activo)
      SELECT 'quota-'||i||'@example.test','Author '||i,'propietario',true FROM generate_series(1,3) i RETURNING id`)).rows.map(r => r.id)]
    const ids = []
    for (const author of authors) ids.push(...await createReviews(author, 6))
    assert.equal((await concurrentClaims(ids)).filter(Boolean).length, 10)
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.intentos_moderacion_resenas')).rows[0].n, 10)
    assert.equal((await db.query('SELECT max(n)::int n FROM (SELECT count(*) n FROM privado.intentos_moderacion_resenas GROUP BY autor_id) a')).rows[0].n <= 5, true)
  })

  await t.test('rolling daily budgets and thirty-day retention remain bounded', async () => {
    await seed()
    const own = await createReviews(1, 21)
    await db.query(`INSERT INTO privado.intentos_moderacion_resenas(resena_id,version,autor_id,solicitada_en)
      SELECT id,1,1,clock_timestamp()-interval '15 minutes' FROM unnest($1::integer[]) id`, [own.slice(0, 20)])
    assert.equal(await claim(own[20]), false, 'twenty author calls in 24 hours exhaust the daily budget')
    await db.query("UPDATE privado.intentos_moderacion_resenas SET solicitada_en=clock_timestamp()-interval '25 hours' WHERE resena_id=$1", [own[0]])
    assert.equal(await claim(own[20]), true)
    await seed()
    const global = await createReviews(1, 200)
    const author = (await db.query("INSERT INTO usuarios(email,nombre,rol,activo) VALUES('new-quota@example.test','New author','propietario',true) RETURNING id")).rows[0].id
    const [next] = await createReviews(author, 1)
    await db.query(`INSERT INTO privado.intentos_moderacion_resenas(resena_id,version,autor_id,solicitada_en)
      SELECT id,1,1,clock_timestamp()-interval '2 hours' FROM unnest($1::integer[]) id`, [global])
    assert.equal(await claim(next), false, 'two hundred global daily calls exhaust the budget')
    await db.query("UPDATE privado.intentos_moderacion_resenas SET solicitada_en=clock_timestamp()-interval '31 days' WHERE resena_id=$1", [global[0]])
    assert.equal(await claim(next), true)
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.intentos_moderacion_resenas WHERE resena_id=$1', [global[0]])).rows[0].n, 0,
      'old provider claims are purged during the atomic budget check')
  })

  await t.test('exact comment, damage details, state and version guard every late result', async () => {
    for (const mutate of [
      () => db.query('UPDATE resenas SET comentario=$1', [`${comment} Información añadida.`]),
      () => db.query("UPDATE resenas SET detalle_dano='Otro texto que no fue evaluado'"),
      () => db.query("UPDATE resenas SET estado='oculta',detalle_verificacion='Rechazo humano'"),
    ]) {
      await seed(); await mutate()
      const before = await review()
      assert.equal((await resolve()).motivo, 'resena_obsoleta')
      assert.deepEqual(await review(), before)
      assert.equal((await audits())[0].decision, 'obsoleta')
    }
    await seed()
    assert.equal((await resolve({ comment: `${comment} Another version.` })).publicada, false)
    assert.equal((await review()).estado, 'borrador')
    await seed()
    assert.equal((await resolve({ damage: 'Unevaluated text' })).publicada, false)
    assert.equal((await review()).estado, 'borrador')
    assert.equal((await resolve({ id: 999 })).motivo, 'resena_no_disponible')
  })

  await t.test('concurrent approval and replay produce one audit, credit, archived version and email', async () => {
    await seed()
    const other = new pg.Client({ connectionString })
    await other.connect()
    try {
      await other.query('SET ROLE service_role')
      const responses = await Promise.all([asRole('service_role', () => resolve()), resolve({ client: other })])
      assert.equal(responses.every(r => r.publicada && r.version === 2), true)
      assert.equal((await resolve()).publicada, true)
      for (const table of ['moderacion_automatica_resenas', 'historial_resenas', 'aportes_consulta', 'avisos_moderacion']) {
        assert.equal((await db.query(`SELECT count(*)::int n FROM privado.${table}`)).rows[0].n, 1)
      }
      await db.query("UPDATE resenas SET estado='oculta',detalle_verificacion='Later human rejection'")
      assert.equal((await resolve()).publicada, false)
      assert.equal((await review()).estado, 'oculta')
    } finally { await other.end() }
  })

  await t.test('authorized corrected drafts are evaluated again without restarting their first approval credit', async () => {
    await seed(); await resolve()
    const first = await review()
    const credit = (await db.query('SELECT * FROM accesos_consulta(ARRAY[1])')).rows[0]
    await db.query("UPDATE resenas SET estado='oculta',permite_correccion=true,detalle_verificacion='Precise el relato'")
    const corrected = `${comment} Precisó los hechos de la entrega.`
    await db.query('SELECT * FROM corregir_resena(1,1,3,$1,false)', [corrected])
    assert.equal((await resolve({ version: 4, comment: corrected })).publicada, true)
    assert.equal((await review()).version, 5)
    assert.equal((await review()).primera_aprobacion_en.toISOString(), first.primera_aprobacion_en.toISOString())
    assert.equal((await db.query('SELECT * FROM accesos_consulta(ARRAY[1])')).rows[0].vence_en.toISOString(), credit.vence_en.toISOString())
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.aportes_consulta')).rows[0].n, 1)
    assert.deepEqual((await audits()).map(a => a.version_evaluada), [1, 4])
  })

  await t.test('publication failures roll back the audit and every side effect', async () => {
    await seed()
    await db.query("ALTER TABLE resenas ADD CONSTRAINT injected_failure CHECK(estado <> 'publicada')")
    try { await assert.rejects(resolve(), /injected_failure/) }
    finally { await db.query('ALTER TABLE resenas DROP CONSTRAINT injected_failure') }
    assert.equal((await review()).estado, 'borrador')
    assert.equal((await review()).version, 1)
    for (const table of ['moderacion_automatica_resenas', 'historial_resenas', 'aportes_consulta', 'avisos_moderacion']) {
      assert.equal((await db.query(`SELECT count(*)::int n FROM privado.${table}`)).rows[0].n, 0)
    }
  })

  await t.test('browser roles cannot approve, inspect audit data or forge administrative access', async () => {
    await seed(); await resolve()
    for (const role of ['anon', 'authenticated']) {
      await asRole(role, async () => {
        await assert.rejects(resolve(), /permission denied for function/)
        await assert.rejects(claim(), /permission denied for function/)
        await assert.rejects(db.query("SELECT guardar_verificacion_cedula('102340567',current_date,'FORGED',(SELECT version FROM padron_tse WHERE id=1))"), /permission denied/)
        await assert.rejects(db.query('SELECT * FROM privado.moderacion_automatica_resenas'), /permission denied/)
        await assert.rejects(db.query('SELECT * FROM privado.intentos_moderacion_resenas'), /permission denied/)
        await assert.rejects(db.query('SELECT * FROM admin_moderacion_automatica_resenas(2,ARRAY[1])'), /permission denied for function/)
      })
    }
    await asRole('service_role', async () => {
      assert.equal((await db.query('SELECT * FROM admin_moderacion_automatica_resenas(2,ARRAY[1])')).rowCount, 1)
      for (const actor of [1, 3, 999]) {
        assert.equal((await db.query('SELECT * FROM admin_moderacion_automatica_resenas($1,ARRAY[1])', [actor])).rowCount, 0)
      }
      await assert.rejects(db.query("UPDATE privado.moderacion_automatica_resenas SET motivo='forged'"), /permission denied/)
    })
  })
})
