import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()

// Always use a disposable database; never load .env or use a live DATABASE_URL.
test('admin review mutations are atomic and restricted to active admins', { timeout: 120_000 }, async (t) => {
  const container = `admin-resenas-test-${process.pid}-${Date.now()}`
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
  const patch = await readFile('db/administrar-resenas.sql', 'utf8')
  const schema = await readFile('schema.sql', 'utf8')
  assert.ok(schema.includes(patch), 'fresh installations must include the same migration')
  await db.query(schema)
  await db.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;`)
  await db.query(patch)

  const seed = async () => {
    await db.query(`TRUNCATE resenas, personas, usuarios RESTART IDENTITY CASCADE;
      INSERT INTO usuarios (email,nombre,rol,activo) VALUES
        ('admin@example.test','Admin','admin',true),
        ('author@example.test','Author','propietario',true),
        ('inactive@example.test','Inactive','admin',false);
      INSERT INTO personas (identificacion,nombre,apellido1) VALUES
        ('102340567','Ana','Solís'),('202340567','Beatriz','Vargas'),('LEGACY-42','Carlos','Legacy');
      INSERT INTO resenas (persona_id,autor_id,comentario,anonima) VALUES
        (1,2,'Original A',true),(1,2,'Original B',false),(3,2,'Legacy',false);`)
  }
  const edit = async (overrides = {}) => {
    const p = { admin: 1, id: 1, cedula: '102340567', nombre: 'Ana', comentario: 'Updated', ...overrides }
    return (await db.query('SELECT * FROM admin_editar_resena($1,$2,$3,$4,$5,$6,$7,$8,$9)', [p.admin,p.id,p.cedula,p.nombre,'','Solís','',p.comentario,true])).rows[0]
  }
  const snapshot = async () => (await db.query(`SELECT jsonb_build_object(
    'personas',(SELECT jsonb_agg(p ORDER BY id) FROM personas p),
    'resenas',(SELECT jsonb_agg(r ORDER BY id) FROM resenas r)) AS datos`)).rows[0].datos

  await t.test('same tenant correction updates all names without moving reviews', async () => {
    await seed()
    const result = await edit({ cedula: '1-0234-0567', nombre: 'Anita' })
    assert.equal(result.movida, false)
    assert.equal(result.autor_email, 'author@example.test')
    assert.equal((await db.query('SELECT nombre FROM personas WHERE id=1')).rows[0].nombre, 'Anita')
    assert.equal((await db.query('SELECT persona_id FROM resenas WHERE id=2')).rows[0].persona_id, 1)
  })
  await t.test('legacy documents remain editable but a newly invalid document is rejected', async () => {
    await seed()
    await edit({ id: 3, cedula: 'LEGACY-42', comentario: 'Corrected legacy review' })
    assert.equal((await db.query('SELECT comentario FROM resenas WHERE id=3')).rows[0].comentario, 'Corrected legacy review')
    const before = await snapshot()
    await assert.rejects(edit({ id: 3, cedula: 'INVALID', nombre: 'Should roll back' }), /6 a 12/)
    assert.deepEqual(await snapshot(), before)
  })
  await t.test('a different existing document moves only the selected review', async () => {
    await seed()
    const result = await edit({ cedula: '2-0234-0567' })
    assert.equal(result.persona_id, 2)
    assert.equal(result.persona_anterior_id, 1)
    assert.equal(result.movida, true)
    assert.equal((await db.query('SELECT persona_id FROM resenas WHERE id=2')).rows[0].persona_id, 1)
    assert.equal((await db.query('SELECT nombre FROM personas WHERE id=2')).rows[0].nombre, 'Beatriz')
  })
  await t.test('a new document splits a tenant with multiple reviews', async () => {
    await seed()
    const result = await edit({ cedula: '303330333', nombre: 'Daniel' })
    assert.notEqual(result.persona_id, 1)
    assert.equal((await db.query('SELECT nombre FROM personas WHERE id=$1', [result.persona_id])).rows[0].nombre, 'Daniel')
    assert.equal((await db.query('SELECT persona_id FROM resenas WHERE id=2')).rows[0].persona_id, 1)
  })
  await t.test('a new document on a single-review tenant keeps its ID', async () => {
    await seed()
    const result = await edit({ id: 3, cedula: '303330333' })
    assert.equal(result.persona_id, 3)
    assert.equal(result.movida, false)
  })
  await t.test('late failures roll back tenant updates and new tenant inserts', async () => {
    await seed()
    await db.query("ALTER TABLE resenas ADD CONSTRAINT injected_failure CHECK (comentario <> 'FAIL')")
    const before = await snapshot()
    for (const cedula of ['102340567', '404440444']) {
      await assert.rejects(edit({ cedula, nombre: 'Must not persist', comentario: 'FAIL' }), /injected_failure/)
      assert.deepEqual(await snapshot(), before)
    }
    await db.query('ALTER TABLE resenas DROP CONSTRAINT injected_failure')
  })
  await t.test('non-admins, inactive admins and missing reviews cannot mutate data', async () => {
    await seed()
    const before = await snapshot()
    for (const admin of [2, 3, 999]) {
      await assert.rejects(edit({ admin }), /No puede administrar/)
      await assert.rejects(db.query('SELECT * FROM admin_eliminar_resena($1,1)', [admin]), /No puede administrar/)
    }
    await assert.rejects(edit({ id: 999 }), /No encontramos/)
    await assert.rejects(db.query('SELECT * FROM admin_eliminar_resena(1,999)'), /No encontramos/)
    assert.deepEqual(await snapshot(), before)
  })
  await t.test('browser database roles cannot invoke privileged functions even with an admin ID', async () => {
    await seed()
    for (const role of ['anon', 'authenticated']) {
      await db.query(`SET ROLE ${role}`)
      try {
        await assert.rejects(edit(), /permission denied for function/)
        await assert.rejects(db.query('SELECT * FROM admin_eliminar_resena(1,1)'), /permission denied for function/)
      } finally { await db.query('RESET ROLE') }
    }
  })
  await t.test('deletion returns the actual author before removing the review and its reports', async () => {
    await seed()
    await db.query("INSERT INTO denuncias(resena_id,denunciante_id,motivo) VALUES(1,1,'otro')")
    await db.query('SET ROLE service_role')
    let result
    try { result = (await db.query('SELECT * FROM admin_eliminar_resena(1,1)')).rows[0] }
    finally { await db.query('RESET ROLE') }
    assert.deepEqual(result, { persona_id: 1, autor_email: 'author@example.test', autor_nombre: 'Author' })
    assert.equal((await db.query('SELECT id FROM resenas WHERE id=1')).rowCount, 0)
    assert.equal((await db.query('SELECT id FROM denuncias WHERE resena_id=1')).rowCount, 0)
  })
})
