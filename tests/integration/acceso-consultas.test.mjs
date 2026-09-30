import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()

// A disposable database only; never loads .env or the application's DATABASE_URL.
test('temporary consultation access: stacking, cap, moderation and RLS', { timeout: 120_000 }, async (t) => {
  const container = `consulta-test-${process.pid}-${Date.now()}`
  let db
  t.after(async () => { await db?.end(); await docker('rm', '-f', container) })
  await docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=consulta_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = Number((await docker('port', container, '5432')).split(':').pop())
  const deadline = Date.now() + 30_000
  while (!db) {
    const candidate = new pg.Client({ connectionString: `postgres://postgres@127.0.0.1:${port}/consulta_test` })
    try { await candidate.connect(); db = candidate }
    catch (error) {
      await candidate.end()
      if (Date.now() > deadline) throw error
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  const uid = 'a1111111-1111-4111-8111-111111111111'
  const adminUid = 'b2222222-2222-4222-8222-222222222222'
  const schema = await readFile('schema.sql', 'utf8')
  const migration = await readFile('db/acceso-temporal-consultas.sql', 'utf8')
  const uniqueMigration = await readFile('db/resenas-unicas.sql', 'utf8')
  const importMigration = await readFile('db/importacion-legacy-resenas.sql', 'utf8')
  assert.ok(schema.includes(migration + '\n' + uniqueMigration + '\n' + importMigration), 'fresh installations include exactly the upgrade migrations')
  await db.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;`)
  // Start with the previous schema to exercise a real populated upgrade.
  await db.query(schema.slice(0, schema.lastIndexOf(migration)))
  await db.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;')
  const seed = async () => {
    await db.query(`RESET ROLE; RESET request.jwt.claim.role; RESET request.jwt.claim.sub;
      TRUNCATE usuarios, personas, resenas RESTART IDENTITY CASCADE;
      INSERT INTO usuarios(nombre,email,rol,auth_user_id) VALUES
        ('Author','author@example.test','propietario','${uid}'),
        ('Admin','admin@example.test','admin','${adminUid}');
      INSERT INTO personas(identificacion,nombre,apellido1) VALUES ('102340567','Ana','Solís');`)
  }
  const access = async (id = 1) => (await db.query('SELECT * FROM accesos_consulta(ARRAY[$1::integer])', [id])).rows[0]
  const review = async (date = new Date().toISOString(), state = 'publicada', count = 1) => {
    await db.query(`WITH next_people AS (
      SELECT coalesce((SELECT max(persona_id) FROM resenas),0) + n AS id
      FROM generate_series(1,$3::integer) n
    ), people AS (
      INSERT INTO personas(identificacion,nombre,apellido1)
      SELECT 'tenant-' || id, 'Tenant', id::text FROM next_people
      ON CONFLICT (identificacion) DO UPDATE SET nombre=EXCLUDED.nombre
      RETURNING id
    ) INSERT INTO resenas(persona_id,autor_id,estado,fuente,creado_en)
      SELECT id,1,$1,'legacy',$2::timestamptz FROM people`, [state, date, count])
  }
  const asUser = async (id, callback) => {
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.role','authenticated',false)", [id])
    await db.query('SET ROLE authenticated')
    try { return await callback() }
    finally { await db.query('RESET ROLE; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;') }
  }
  const visible = async () => (await db.query('SELECT id FROM personas')).rowCount

  await t.test('upgrade preserves historical dates and remains idempotent', async () => {
    await seed()
    await review('2020-01-31T12:00:00Z')
    await review('2020-01-01T12:00:00Z', 'borrador')
    await db.query(migration)
    const before = await access()
    assert.equal(before.vence_en.toISOString(), '2020-04-30T12:00:00.000Z')
    assert.equal(before.motivo, 'vencida')
    assert.equal(before.puede_consultar, false)
    await db.query(migration)
    assert.deepEqual(await access(), before)
    assert.equal((await db.query("SELECT primera_aprobacion_en FROM resenas WHERE estado='borrador'")).rows[0].primera_aprobacion_en, null)
  })
  await t.test('zero, pending and rejected reviews never unlock consultation', async () => {
    await seed()
    assert.equal((await access()).motivo, 'ninguna')
    await review(undefined, 'oculta', 4)
    assert.equal((await access()).motivo, 'rechazada')
    await review(undefined, 'borrador', 4)
    const result = await access()
    assert.equal(result.motivo, 'revision')
    assert.equal(result.aprobadas, 0)
    assert.equal(result.puede_consultar, false)
    assert.equal(result.vence_en, null)
    await asUser(uid, async () => {
      assert.equal(await visible(), 0)
      assert.equal((await db.query('SELECT id FROM resenas')).rowCount, 0)
    })
  })
  await t.test('rewards stack in calendar months and stop at twelve months', async () => {
    for (const [count, start, end] of [
      [1, '2024-01-31T18:42:00Z', '2024-04-30T18:42:00.000Z'],
      [1, '2025-01-31T18:42:00Z', '2025-04-30T18:42:00.000Z'],
      [2, '2024-01-31T18:42:00Z', '2024-07-30T18:42:00.000Z'],
      [3, '2024-02-29T18:42:00Z', '2024-11-29T18:42:00.000Z'],
      [4, '2024-02-29T18:42:00Z', '2025-02-28T18:42:00.000Z'],
      [1001, '2024-01-31T18:42:00Z', '2025-01-31T18:42:00.000Z'],
    ]) {
      await seed()
      await review(start, 'publicada', count)
      // Connection timezone must not change the policy's calendar arithmetic.
      await db.query("SET timezone='Pacific/Auckland'")
      const result = await access()
      assert.equal(result.aprobadas, count)
      assert.equal(result.vence_en.toISOString(), end)
      assert.equal(result.puede_consultar, false)
    }
    await db.query("SET timezone='UTC'")
  })
  await t.test('a fresh approval starts three months after an expired balance', async () => {
    for (const count of [1, 2, 3, 4]) {
      await seed()
      if (count > 1) await review('2020-01-01T00:00:00Z', 'publicada', count - 1)
      await review('2020-01-01T00:00:00Z', 'borrador')
      await db.query("UPDATE resenas SET estado='publicada' WHERE estado='borrador'")
      const result = await access()
      assert.equal(result.puede_consultar, true)
      assert.equal(result.aprobadas, count)
      assert.ok(Date.now() - result.ultima_aprobacion_en.getTime() < 10_000)
      const expected = (await db.query("SELECT $1::timestamptz + interval '3 months' AS fecha", [result.ultima_aprobacion_en])).rows[0].fecha
      assert.deepEqual(result.vence_en, expected)
      await asUser(uid, async () => {
        assert.equal(await visible(), count + 1)
        assert.equal((await db.query('SELECT id FROM resenas')).rowCount, count)
        const own = (await db.query('SELECT * FROM mi_acceso_consulta()')).rows[0]
        assert.deepEqual(own, result)
      })
    }
  })
  await t.test('later approvals preserve the remaining balance and move the twelve-month cap', async () => {
    await seed()
    await review('2024-01-15T12:00:00Z')
    await review('2024-02-15T12:00:00Z')
    assert.equal((await access()).vence_en.toISOString(), '2024-07-15T12:00:00.000Z')
    await review('2024-03-15T12:00:00Z', 'publicada', 4)
    assert.equal((await access()).vence_en.toISOString(), '2025-03-15T12:00:00.000Z')
    await review('2024-04-15T12:00:00Z')
    assert.equal((await access()).vence_en.toISOString(), '2025-04-15T12:00:00.000Z')
    await review('2026-01-15T12:00:00Z')
    assert.equal((await access()).vence_en.toISOString(), '2026-04-15T12:00:00.000Z')
  })
  await t.test('expiry denies access at the cutoff and every later request', async () => {
    await seed()
    await db.query('BEGIN')
    try {
      // Keep PostgreSQL's microsecond precision and a fixed transaction clock.
      // Five rewards reach the cap even if intermediate month ends clamp.
      for (const delta of [1, 0, -1]) {
        await db.query("INSERT INTO personas(id,identificacion,nombre,apellido1) SELECT n, 'cutoff-' || n, 'Tenant', n::text FROM generate_series(2,5) n ON CONFLICT (id) DO NOTHING")
        await db.query(`WITH tier AS (
          SELECT CASE WHEN now()-interval '3 months'+interval '3 months'=now() THEN 1 ELSE 5 END AS n
        ) INSERT INTO resenas(persona_id,autor_id,estado,fuente,creado_en,fecha_inicio_alquiler)
          SELECT i,1,'publicada','legacy',now()-(CASE WHEN n=1 THEN interval '3 months' ELSE interval '12 months' END)+$1*interval '1 microsecond',
            DATE '2000-01-01' + i
          FROM tier, generate_series(1,tier.n) i`, [delta])
        assert.equal((await access()).puede_consultar, delta > 0)
        await asUser(uid, async () => {
          assert.equal(await visible(), delta > 0 ? 5 : 0)
          assert.equal((await db.query('SELECT privado.puede_leer_registro() AS allowed')).rows[0].allowed, delta > 0)
        })
        await db.query('TRUNCATE resenas, privado.aportes_consulta CASCADE')
      }
    } finally { await db.query('ROLLBACK') }
  })
  await t.test('duplicates, resubmissions and changed rental details cannot earn the same reward twice', async () => {
    await seed()
    await db.query(`INSERT INTO resenas(persona_id,autor_id,estado,fuente,creado_en,fecha_inicio_alquiler)
      VALUES (1,1,'publicada','legacy','2020-01-15','2019-01-01')`)
    const original = await access()
    await db.query(`INSERT INTO resenas(persona_id,autor_id,estado,fecha_inicio_alquiler)
      VALUES (1,1,'publicada','2019-01-01')`)
    assert.deepEqual(await access(), original)
    await db.query('DELETE FROM resenas WHERE id=1')
    assert.deepEqual(await access(), original)
    await db.query("UPDATE resenas SET estado='borrador', fecha_inicio_alquiler='2020-01-01'")
    assert.equal((await access()).puede_consultar, false)
    await db.query("UPDATE resenas SET estado='publicada'")
    assert.deepEqual(await access(), original)
    await db.query(migration)
    assert.deepEqual(await access(), original)
    await db.query('DELETE FROM resenas')
    assert.equal((await access()).aprobadas, 0)
    await db.query(`INSERT INTO resenas(persona_id,autor_id,estado,fecha_inicio_alquiler)
      VALUES (1,1,'publicada','2019-01-01')`)
    assert.deepEqual(await access(), original)
    // A different tenancy, missing date or review type cannot renew the same pair.
    await db.query(`INSERT INTO resenas(persona_id,autor_id,estado,fecha_inicio_alquiler)
      VALUES (1,1,'publicada','2021-01-01')`)
    assert.deepEqual(await access(), original)
    await db.query(`INSERT INTO resenas(persona_id,autor_id,estado,tipo)
      VALUES (1,1,'publicada','propietario'), (1,1,'publicada','inquilino')`)
    assert.deepEqual(await access(), original)
    // A different author can earn their own reward for this tenant.
    await db.query(`INSERT INTO usuarios(nombre,email,rol) VALUES ('Other','other@example.test','propietario');
      INSERT INTO resenas(persona_id,autor_id,estado) VALUES (1,3,'publicada')`)
    assert.equal((await access(3)).aprobadas, 1)
    assert.equal((await access(3)).puede_consultar, true)
    assert.deepEqual(await access(), original)
  })
  await t.test('historical reviews without rental dates count as one experience per author and person', async () => {
    await seed()
    await db.query(`INSERT INTO resenas(persona_id,autor_id,estado,fuente,creado_en)
      SELECT 1,1,'publicada','legacy','2020-01-01' FROM generate_series(1,5)`)
    assert.equal((await access()).aprobadas, 1)
    assert.equal((await access()).vence_en.toISOString(), '2020-04-01T00:00:00.000Z')
  })
  await t.test('simultaneous approvals neither duplicate rewards nor lose distinct contributions', async () => {
    const other = new pg.Client({ connectionString: `postgres://postgres@127.0.0.1:${port}/consulta_test` })
    await other.connect()
    try {
      for (const same of [true, false]) {
        await seed()
        await db.query("INSERT INTO personas(identificacion,nombre,apellido1) VALUES ('204560789','Other','Tenant')")
        await db.query(`INSERT INTO resenas(persona_id,autor_id,estado,fecha_inicio_alquiler)
          VALUES (1,1,'borrador','2020-01-01'), ($1,1,'borrador',NULL)`, [same ? 1 : 2])
        await Promise.all([db.query('BEGIN'), other.query('BEGIN')])
        try {
          await Promise.all([
            db.query("UPDATE resenas SET estado='publicada' WHERE id=1"),
            other.query("UPDATE resenas SET estado='publicada' WHERE id=2"),
          ])
          await Promise.all([db.query('COMMIT'), other.query('COMMIT')])
        } catch (error) {
          await Promise.all([db.query('ROLLBACK'), other.query('ROLLBACK')])
          throw error
        }
        const result = await access()
        assert.equal(result.aprobadas, same ? 1 : 2)
        const expected = (await db.query(`SELECT CASE WHEN $1::boolean
          THEN min(primera_aprobacion_en) + interval '3 months'
          ELSE min(primera_aprobacion_en) + interval '3 months' + interval '3 months'
          END AS fecha FROM resenas`, [same])).rows[0].fecha
        assert.deepEqual(result.vence_en, expected)
      }
    } finally { await other.end() }
  })
  await t.test('content edits, supplied timestamps and repeated moderation cannot renew a review', async () => {
    await seed()
    await review('2020-01-01T00:00:00Z')
    const original = await access()
    await db.query("UPDATE resenas SET comentario='Edited', primera_aprobacion_en=now(), creado_en=now(), actualizado_en=now()")
    assert.deepEqual(await access(), original)
    await db.query("UPDATE resenas SET estado='oculta'")
    assert.equal((await access()).puede_consultar, false)
    await db.query("UPDATE resenas SET estado='publicada'")
    assert.deepEqual(await access(), original)
    await db.query(migration)
    assert.deepEqual(await access(), original)
  })
  await t.test('rejection and deletion immediately downgrade or revoke permission', async () => {
    await seed()
    const threeMonthsAgo = (await db.query("SELECT now()-interval '3 months' AS fecha")).rows[0].fecha
    await review(threeMonthsAgo, 'publicada', 2)
    assert.equal((await access()).puede_consultar, true)
    await db.query("UPDATE resenas SET estado='oculta' WHERE id=2")
    assert.equal((await access()).motivo, 'vencida')
    await asUser(uid, async () => assert.equal(await visible(), 0))
    await db.query('DELETE FROM resenas WHERE id=1')
    assert.equal((await access()).aprobadas, 0)
    assert.equal((await access()).puede_consultar, false)
    await review()
    assert.equal((await access()).puede_consultar, true)
    await db.query('UPDATE usuarios SET activo=false WHERE id=1')
    assert.equal((await access()).motivo, 'inactiva')
    await asUser(uid, async () => assert.equal(await visible(), 0))
  })
  await t.test('active admins are exempt; inactive admins and missing sessions are denied', async () => {
    await seed()
    assert.equal((await access(2)).motivo, 'administracion')
    assert.equal((await access(2)).vence_en, null)
    await asUser(adminUid, async () => assert.equal(await visible(), 1))
    await db.query('UPDATE usuarios SET activo=false WHERE id=2')
    await asUser(adminUid, async () => assert.equal(await visible(), 0))
    await asUser('', async () => {
      assert.equal(await visible(), 0)
      assert.equal((await db.query('SELECT * FROM mi_acceso_consulta()')).rowCount, 0)
    })
  })
  await t.test('expired users can submit pending reviews but cannot forge approval or query other accounts', async () => {
    await seed()
    await review('2020-01-01T00:00:00Z')
    await asUser(uid, async () => {
      await db.query("INSERT INTO resenas(persona_id,autor_id,estado,primera_aprobacion_en) VALUES(1,1,'borrador',now())")
      await assert.rejects(db.query("INSERT INTO resenas(persona_id,autor_id,estado) VALUES(1,1,'publicada')"), /row-level security/)
      await assert.rejects(db.query("UPDATE resenas SET primera_aprobacion_en=now()"), /permission denied/)
      await assert.rejects(db.query('SELECT * FROM accesos_consulta(ARRAY[2])'), /permission denied/)
      await assert.rejects(db.query('SELECT * FROM privado.aportes_consulta'), /permission denied/)
      await assert.rejects(db.query('DELETE FROM privado.aportes_consulta'), /permission denied/)
      assert.equal((await db.query('SELECT * FROM mi_acceso_consulta()')).rows[0].usuario_id, 1)
      await assert.rejects(db.query("INSERT INTO denuncias(resena_id,denunciante_id,motivo) VALUES(1,1,'otro')"), /row-level security/)
    })
    assert.equal((await db.query("SELECT primera_aprobacion_en FROM resenas WHERE estado='borrador'")).rows[0].primera_aprobacion_en, null)
    await db.query('SET ROLE anon')
    try {
      await assert.rejects(db.query('SELECT * FROM accesos_consulta(ARRAY[1])'), /permission denied/)
      await assert.rejects(db.query('SELECT * FROM mi_acceso_consulta()'), /permission denied/)
      await assert.rejects(db.query('SELECT id FROM personas'), /permission denied/)
    } finally { await db.query('RESET ROLE') }
    await db.query('SET ROLE service_role')
    try { assert.equal((await access()).motivo, 'vencida') }
    finally { await db.query('RESET ROLE') }
  })
  await t.test('valid users can file and read their own reports without exposing the private auth column', async () => {
    await seed()
    await review()
    await asUser(uid, async () => {
      await db.query("INSERT INTO denuncias(resena_id,denunciante_id,motivo) VALUES(1,1,'otro')")
      assert.equal((await db.query('SELECT id FROM denuncias')).rowCount, 1)
      await assert.rejects(db.query("INSERT INTO denuncias(resena_id,denunciante_id,motivo) VALUES(1,2,'otro')"), /row-level security/)
    })
    await asUser(adminUid, async () => assert.equal((await db.query('SELECT id FROM denuncias')).rowCount, 0))
  })
  await t.test('uniqueness migration refuses historical duplicates without deleting data', async () => {
    await seed()
    await db.query(`INSERT INTO resenas(persona_id,autor_id,estado,fecha_inicio_alquiler)
      VALUES (1,1,'publicada','2020-01-01'), (1,1,'oculta',NULL)`)
    const before = (await db.query('SELECT * FROM resenas ORDER BY id')).rows
    await assert.rejects(db.query(uniqueMigration), /Revise los duplicados/)
    await db.query('ROLLBACK')
    assert.deepEqual((await db.query('SELECT * FROM resenas ORDER BY id')).rows, before)
  })
  await t.test('one review per owner and tenant applies to every state and permits other owners', async () => {
    await seed()
    await db.query(uniqueMigration)
    await db.query(uniqueMigration)
    for (const state of ['borrador', 'publicada', 'oculta']) {
      await seed()
      await db.query('INSERT INTO resenas(persona_id,autor_id,estado) VALUES (1,1,$1)', [state])
      for (const nextState of ['borrador', 'publicada', 'oculta']) {
        await assert.rejects(db.query(`INSERT INTO resenas(persona_id,autor_id,estado,tipo,fecha_inicio_alquiler)
          VALUES (1,1,$1,'propietario','2025-01-01')`, [nextState]),
        (error) => error.code === '23505' && error.constraint === 'resenas_autor_persona_unica')
      }
      await db.query(`INSERT INTO usuarios(nombre,email,rol) VALUES ('Other','other@example.test','propietario');
        INSERT INTO resenas(persona_id,autor_id,estado) VALUES (1,3,'publicada');
        UPDATE resenas SET comentario='Updated existing review' WHERE autor_id=1`)
      assert.equal((await db.query('SELECT id FROM resenas')).rowCount, 2)
      assert.equal((await access(3)).aprobadas, 1)
      await assert.rejects(db.query('UPDATE resenas SET autor_id=1 WHERE autor_id=3'),
        (error) => error.constraint === 'resenas_autor_persona_unica')
    }
  })
  await t.test('simultaneous submissions for the same pair save exactly one review', async () => {
    await seed()
    const other = new pg.Client({ connectionString: `postgres://postgres@127.0.0.1:${port}/consulta_test` })
    await other.connect()
    try {
      const sql = "INSERT INTO resenas(persona_id,autor_id,estado) VALUES (1,1,'borrador')"
      const results = await Promise.allSettled([db.query(sql), other.query(sql)])
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
      const failure = results.find((r) => r.status === 'rejected')
      assert.equal(failure.reason.constraint, 'resenas_autor_persona_unica')
      assert.equal((await db.query('SELECT id FROM resenas')).rowCount, 1)
    } finally { await other.end() }
  })
  await t.test('legacy originals remain private after upgrades, with RLS as defense in depth', async () => {
    await seed()
    await db.query(importMigration)
    await db.query(`INSERT INTO privado.resenas_legacy_originales(id_fuente,huella,datos)
      VALUES (10,repeat('a',64),'{"camp_comentario_adicional":"Original privado"}')`)
    // Reapplying the migration must revoke grants inherited from an older setup.
    await db.query('GRANT ALL ON privado.resenas_legacy_originales TO anon, authenticated')
    await db.query(importMigration)
    assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class
      WHERE oid='privado.resenas_legacy_originales'::regclass`)).rows[0].relrowsecurity, true)
    for (const role of ['anon', 'authenticated']) {
      const privileges = (await db.query(`SELECT
        has_table_privilege($1,'privado.resenas_legacy_originales','SELECT') AS lectura,
        has_table_privilege($1,'privado.resenas_legacy_originales','INSERT') AS escritura,
        has_table_privilege($1,'privado.resenas_legacy_originales','UPDATE') AS cambios,
        has_table_privilege($1,'privado.resenas_legacy_originales','DELETE') AS borrado`, [role])).rows[0]
      assert.deepEqual(privileges, { lectura: false, escritura: false, cambios: false, borrado: false })
      await db.query(`SET ROLE ${role}`)
      try {
        await assert.rejects(db.query('SELECT * FROM privado.resenas_legacy_originales'), (error) => error.code === '42501')
      } finally { await db.query('RESET ROLE') }
    }
    // Even an accidental read/write grant cannot expose or alter originals.
    await db.query('GRANT SELECT, INSERT ON privado.resenas_legacy_originales TO authenticated')
    try {
      await asUser(uid, async () => {
        assert.equal((await db.query('SELECT * FROM privado.resenas_legacy_originales')).rowCount, 0)
        await assert.rejects(db.query(`INSERT INTO privado.resenas_legacy_originales(id_fuente,huella,datos)
          VALUES (11,repeat('b',64),'{}')`), /row-level security/)
      })
    } finally { await db.query(importMigration) }
    assert.equal((await db.query('SELECT * FROM privado.resenas_legacy_originales')).rowCount, 1)
  })
  await t.test('only a privileged import can retain historical approval on an updated legacy review', async () => {
    await seed()
    await db.query('BEGIN')
    try {
      await db.query(importMigration)
      await review('2020-01-31T12:00:00Z', 'borrador', 7)
      await db.query("UPDATE resenas SET fuente=NULL WHERE id=5; UPDATE resenas SET creado_en='2099-01-01T00:00:00Z' WHERE id=6")
      // Temporarily allow an ordinary SQL role to moderate so a forged flag
      // reaches the trigger's privilege check. These permissions roll back.
      await db.query(`GRANT UPDATE(estado), SELECT(primera_aprobacion_en) ON resenas TO authenticated;
        CREATE POLICY test_legacy_approval_read ON resenas FOR SELECT TO authenticated USING (true);
        CREATE POLICY test_legacy_approval_update ON resenas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);`)
      const publish = async (id, flag, role = 'postgres') => {
        await db.query("SELECT set_config('laprotec.importacion_legacy',$1,true)", [flag ? 'on' : 'off'])
        await db.query(`SET LOCAL ROLE ${role}`)
        try {
          return (await db.query(`UPDATE resenas SET estado='publicada' WHERE id=$1
            RETURNING primera_aprobacion_en, now() AS actual`, [id])).rows[0]
        } finally { await db.query('RESET ROLE') }
      }
      for (const [id, role] of [[1, 'postgres'], [3, 'service_role']]) {
        const imported = await publish(id, true, role)
        assert.equal(imported.primera_aprobacion_en.toISOString(), '2020-01-31T12:00:00.000Z')
        const receipt = (await db.query('SELECT aprobada_en FROM privado.aportes_consulta WHERE resena_id=$1', [id])).rows[0]
        assert.deepEqual(receipt.aprobada_en, imported.primera_aprobacion_en)
      }
      for (const [id, flag, role] of [
        [2, false, 'postgres'],
        [4, true, 'authenticated'],
        [5, true, 'postgres'],
        [6, true, 'postgres'],
        [7, false, 'service_role'],
      ]) {
        const moderated = await publish(id, flag, role)
        assert.deepEqual(moderated.primera_aprobacion_en, moderated.actual,
          'manual moderation, a forged ordinary-role flag, native reviews and future dates must use now')
      }
      const before = (await db.query('SELECT primera_aprobacion_en FROM resenas WHERE id=1')).rows[0]
      await db.query("UPDATE resenas SET estado='oculta', primera_aprobacion_en=now(), creado_en=now() WHERE id=1")
      const repeated = await publish(1, true)
      assert.deepEqual(repeated.primera_aprobacion_en, before.primera_aprobacion_en)
      assert.deepEqual((await db.query('SELECT aprobada_en FROM privado.aportes_consulta WHERE resena_id=1')).rows[0].aprobada_en,
        before.primera_aprobacion_en)
      assert.equal((await db.query(`SELECT prosecdef FROM pg_proc
        WHERE oid='privado.registrar_primera_aprobacion()'::regprocedure`)).rows[0].prosecdef, false)
    } finally { await db.query('ROLLBACK') }
  })
})
