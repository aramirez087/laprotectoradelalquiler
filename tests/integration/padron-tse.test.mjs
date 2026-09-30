import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()

test('padrón metadata and quotas are service-only, atomic and protected from stale publication', { timeout: 120_000 }, async t => {
  const container = `padron-test-${process.pid}-${Date.now()}`
  let db
  t.after(async () => { await db?.end(); await docker('rm', '-f', container) })
  await docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=padron_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = Number((await docker('port', container, '5432')).split(':').pop())
  const connectionString = `postgres://postgres@127.0.0.1:${port}/padron_test`
  const deadline = Date.now() + 30_000
  while (!db) {
    const candidato = new pg.Client({ connectionString })
    try { await candidato.connect(); db = candidato }
    catch (error) { await candidato.end(); if (Date.now() > deadline) throw error; await new Promise(resolve => setTimeout(resolve, 200)) }
  }
  await db.query('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;')
  const patch = await readFile('db/verificacion-cedulas-tse.sql', 'utf8')
  assert.ok((await readFile('schema.sql', 'utf8')).includes(patch))
  assert.equal(await readFile('supabase/migrations/20260930120106_verificacion_cedulas_tse.sql', 'utf8'), patch)
  await db.query(patch)
  await db.query(patch) // repeatable additive migration
  const publicar = async fecha => (await db.query('SELECT publicar_padron_tse($1,$2,$3,$4,$5) AS ok', [`${fecha}-${'a'.repeat(16)}`, fecha, ['102'], 3_760_497, 'a'.repeat(64)])).rows[0].ok
  await db.query('SET ROLE service_role')
  assert.equal(await publicar('2026-08-31'), true)
  assert.equal(await publicar('2026-07-31'), false)
  assert.equal((await db.query('SELECT fecha_padron::text FROM padron_tse')).rows[0].fecha_padron, '2026-08-31')
  const clave = 'b'.repeat(64)
  for (let i = 0; i < 30; i++) assert.equal((await db.query('SELECT consumir_consulta_padron($1) AS ok', [clave])).rows[0].ok, true)
  assert.equal((await db.query('SELECT consumir_consulta_padron($1) AS ok', [clave])).rows[0].ok, false)
  await db.query("UPDATE limites_consulta_padron SET ventana = now() - interval '11 minutes'")
  assert.equal((await db.query('SELECT consumir_consulta_padron($1) AS ok', [clave])).rows[0].ok, true)
  await db.query('RESET ROLE')
  const rls = (await db.query("SELECT bool_and(relrowsecurity) AS rls FROM pg_class WHERE oid IN ('public.padron_tse'::regclass,'public.limites_consulta_padron'::regclass)")).rows[0].rls
  assert.equal(rls, true)
  for (const role of ['anon', 'authenticated']) {
    await db.query(`SET ROLE ${role}`)
    await assert.rejects(db.query('SELECT * FROM padron_tse'), /permission denied/)
    await assert.rejects(db.query('SELECT consumir_consulta_padron($1)', [clave]), /permission denied/)
    await assert.rejects(publicar('2026-09-01'), /permission denied/)
    await assert.rejects(db.query("SELECT * FROM admin_editar_resena(1,1,'102340567','A','','Q','','Una experiencia',false)"), /permission denied/)
    await db.query('RESET ROLE')
  }
  await db.query("DELETE FROM limites_consulta_padron; SET ROLE service_role")
  // Separate connections assert the quota survives overlapping serverless requests.
  const clientes = Array.from({ length: 36 }, () => new pg.Client({ connectionString }))
  try {
    const resultados = await Promise.all(clientes.map(async cliente => {
      await cliente.connect()
      await cliente.query('SET ROLE service_role')
      return (await cliente.query('SELECT consumir_consulta_padron($1) AS ok', [clave])).rows[0].ok
    }))
    assert.equal(resultados.filter(Boolean).length, 30)
  } finally { await Promise.all(clientes.map(cliente => cliente.end())) }

  // Official name components may have only one letter; keep the admin RPC compatible.
  await db.query(`RESET ROLE;
    CREATE TABLE usuarios (id integer PRIMARY KEY, rol text, activo boolean, email text, nombre text);
    CREATE TABLE personas (id serial PRIMARY KEY, identificacion text UNIQUE, nombre text, nombre2 text, apellido1 text, apellido2 text, actualizado_en timestamptz);
    CREATE TABLE resenas (id integer PRIMARY KEY, persona_id integer, autor_id integer, comentario text, anonima boolean, actualizado_en timestamptz);
    INSERT INTO usuarios VALUES (1,'admin',true,'admin@example.test','Admin'),(2,'propietario',true,'author@example.test','Author');
    INSERT INTO personas (identificacion,nombre,apellido1) VALUES ('102340567','Anterior','Anterior');
    INSERT INTO resenas VALUES (1,1,2,'Anterior',false,now());
    GRANT ALL ON usuarios, personas, resenas TO service_role;
    SET ROLE service_role;`)
  await db.query("SELECT * FROM admin_editar_resena(1,1,'102340567','A','','Q','','Una experiencia',false)")
  const guardado = (await db.query('SELECT nombre, apellido1 FROM personas WHERE id = 1')).rows[0]
  assert.deepEqual(guardado, { nombre: 'A', apellido1: 'Q' })
})
