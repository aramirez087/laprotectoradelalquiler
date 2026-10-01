import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { PostgrestClient } = require('@supabase/postgrest-js')

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()
const pause = ms => new Promise(r => setTimeout(r, ms))

// Real Postgres, synthetic fixtures; never reads .env or connects to production.
test('ranked search and private outcome receipts', { timeout: 120_000 }, async t => {
  const container = `busqueda-test-${process.pid}-${Date.now()}`
  const network = `${container}-net`, rest = `${container}-rest`
  let db
  t.after(async () => { await db?.end(); await Promise.allSettled([docker('rm', '-f', container),docker('rm','-f',rest)]); await docker('network','rm',network) })
  await docker('network','create',network)
  await docker('run', '--rm', '-d', '--name', container, '--network',network, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', 'POSTGRES_DB=busqueda_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = (await docker('port', container, '5432')).split(':').pop()
  const connectionString = `postgres://postgres@127.0.0.1:${port}/busqueda_test`
  const deadline = Date.now() + 30000
  while (!db) {
    const candidate = new pg.Client({ connectionString })
    try { await candidate.connect(); db = candidate }
    catch (error) { await candidate.end(); if (Date.now() > deadline) throw error; await pause(200) }
  }
  await db.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;`)
  const schema = await readFile('schema.sql', 'utf8')
  const migration = await readFile('db/busqueda-relevante.sql', 'utf8')
  assert.ok(schema.endsWith(migration))
  await db.query(schema.slice(0, schema.length - migration.length))
  await db.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
    INSERT INTO usuarios(email,nombre,rol,auth_user_id) VALUES
      ('admin@example.test','Admin','admin','00000000-0000-0000-0000-000000000001'),
      ('author@example.test','Author','propietario','00000000-0000-0000-0000-000000000002'),
      ('agency@example.test','Agency','agencia','00000000-0000-0000-0000-000000000003'),
      ('empty@example.test','No access','propietario','00000000-0000-0000-0000-000000000004');
    INSERT INTO personas(identificacion,nombre,nombre2,apellido1,apellido2) VALUES
      ('1-0234-0567','José',NULL,'Muñoz',NULL),
      ('10234056799','Joselito',NULL,'Muñoz',NULL),
      ('222200001','José','Andrés','Muñoz','Alfaro'),
      ('333300001','Josué',NULL,'Muñoz',NULL),
      ('444400001','José',NULL,'Muñoz','Invisible'),
      ('AB-123456','Ana',NULL,'Mora',NULL);
    INSERT INTO resenas(persona_id,autor_id,comentario,estado) SELECT id,2,'Synthetic rental experience.','publicada' FROM personas WHERE id<>5;
    INSERT INTO resenas(persona_id,autor_id,comentario,estado) VALUES(1,3,'Second published experience.','publicada'),
      (5,2,'Not public.','borrador');`)
  const before = (await db.query('SELECT * FROM personas ORDER BY id')).rows
  await db.query(migration)
  await db.query(migration)
  assert.deepEqual((await db.query('SELECT * FROM personas ORDER BY id')).rows, before)
  const search = async (q='', page=1, user=1) => (await db.query('SELECT buscar_fichas_relevantes($1,$2,$3) r',[user,q,page])).rows[0].r
  const role = async (name, fn) => { await db.query(`SET ROLE ${name}`); try { return await fn() } finally { await db.query('RESET ROLE') } }

  await t.test('exact documents outrank prefixes; formatting and foreign documents normalize safely', async () => {
    for (const q of ['102340567','1-0234-0567','1.0234.0567','1 0234 0567']) {
      const r = await search(q)
      assert.equal(r.total,2)
      assert.deepEqual(r.fichas.map(f=>f.persona.id),[1,2])
      assert.deepEqual(r.fichas.map(f=>f.coincidencia),['documento_exacto','documento_parcial'])
      assert.equal(r.fichas[0].resenas,2)
    }
    assert.equal((await search('ab123456')).fichas[0].persona.id,6)
    assert.equal((await search('2340567')).total,0, 'documents match from the start, never an arbitrary substring')
    assert.equal((await search('102')).total,0)
  })
  await t.test('accented multi-word names rank exact words above partials, ignoring order without fuzzy identity claims', async () => {
    for (const q of ['José Muñoz','Jose Munoz','JOSE MUÑOZ','Jose\u0301 Mun\u0303oz']) {
      const r=await search(q)
      assert.deepEqual(r.fichas.map(f=>f.persona.id),[1,3,2])
      assert.deepEqual(r.fichas.map(f=>f.coincidencia),['nombre_completo','palabras_completas','nombre_parcial'])
    }
    assert.deepEqual((await search('Munoz Jose')).fichas.map(f=>f.persona.id),[1,3,2])
    assert.equal((await search('Jos Mun')).total,4)
    assert.equal((await search('Josee Munoz')).total,0,'typos must not silently match another identity')
    assert.equal((await search('%%___')).total,0)
    assert.equal((await search('J')).total,0)
    assert.equal((await search('José | Muñoz:*')).total,3,'tsquery syntax is treated as text')
    assert.ok((await search()).fichas.every(f=>f.persona.id!==5))
  })
  await t.test('ranking precedes pagination, totals survive out-of-range pages and ties stay stable', async () => {
    await db.query(`INSERT INTO personas(identificacion,nombre,apellido1) SELECT 'fixture-'||n,'Ana','Paginacion' FROM generate_series(1,25)n;
      INSERT INTO resenas(persona_id,autor_id,comentario,estado) SELECT id,2,'Synthetic experience.','publicada' FROM personas WHERE apellido1='Paginacion';`)
    const first=await search('Ana Pag'),second=await search('Ana Pag',2),outside=await search('Ana Pag',3)
    assert.equal(first.total,25); assert.equal(first.fichas.length,20);assert.equal(second.fichas.length,5)
    assert.equal(new Set([...first.fichas,...second.fichas].map(f=>f.persona.id)).size,25)
    assert.equal(outside.total,25);assert.deepEqual(outside.fichas,[])
    assert.deepEqual(await search('Ana Pag'),first)
    for(const page of [0,-1,100001,null]) await assert.rejects(search('Ana',page),/inválida/)
    await assert.rejects(search('x'.repeat(151)),/inválida/)
  })
  await t.test('both SQL and client roles enforce current access', async () => {
    await assert.rejects(search('Jose',1,4),/autorizada/)
    await db.query('UPDATE usuarios SET activo=false WHERE id=2')
    await assert.rejects(search('Jose',1,2),/autorizada/)
    await db.query('UPDATE usuarios SET activo=true WHERE id=2')
    for(const name of ['anon','authenticated']) await role(name,async()=>{
      await assert.rejects(search('Jose'),/permission denied/)
      await assert.rejects(db.query('SELECT * FROM privado.resultados_busqueda'),/permission denied/)
      await assert.rejects(db.query('SELECT resumen_resultados_busqueda(1,7)'),/permission denied/)
    })
    await role('service_role',async()=>assert.equal((await search('Jose')).total,3))
  })
  await t.test('real Data API RPC responses preserve rank, counts, empty pages and server-only execution',async()=>{
    await docker('run','--rm','-d','--name',rest,'--network',network,
      '-e',`PGRST_DB_URI=postgres://postgres@${container}:5432/busqueda_test`,
      '-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=service_role',
      '-p','127.0.0.1::3000','postgrest/postgrest:v14.2')
    const restPort=(await docker('port',rest,'3000')).split(':').pop()
    const base=`http://127.0.0.1:${restPort}`,ready=Date.now()+30000
    while(true) {
      try {if((await fetch(base)).ok)break}catch{/*startup*/}
      if(Date.now()>ready)throw new Error('Disposable Data API startup timeout')
      await pause(200)
    }
    const api=new PostgrestClient(base)
    for(const [q,page] of [['1-0234-0567',1],['Jose Munoz',1],['Ana Pag',2],['Ana Pag',5],['Nadie Encontrado',1]]) {
      const {data,error}=await api.rpc('buscar_fichas_relevantes',{p_usuario_id:2,p_q:q,p_pagina:page})
      assert.equal(error,null);assert.deepEqual(data,await search(q,page,2))
    }
    const denied=await api.rpc('buscar_fichas_relevantes',{p_usuario_id:4,p_q:'Jose',p_pagina:1})
    assert.equal(denied.error.code,'42501')
  })
  await t.test('search execution uses normalized indexes on a larger registry',async()=>{
    await db.query(`INSERT INTO personas(identificacion,nombre,apellido1) SELECT '90000'||lpad(n::text,5,'0'),'Otra','Persona'||n FROM generate_series(1,3000)n;
      INSERT INTO resenas(persona_id,autor_id,comentario,estado) SELECT id,2,'Synthetic experience.','publicada' FROM personas WHERE nombre='Otra';
      ANALYZE personas; ANALYZE resenas;
      LOAD 'auto_explain'; SET auto_explain.log_min_duration=0; SET auto_explain.log_nested_statements=on;
      SET client_min_messages=log;`)
    const plans=[]
    const collect=notice=>plans.push(notice.message)
    db.on('notice',collect)
    try {
      await search('Jose Munoz')
      assert.ok(plans.some(plan=>plan.includes('idx_personas_nombre_busqueda')),'name query must use the normalized GIN index')
      plans.length=0
      await search('102340567')
      assert.ok(plans.some(plan=>plan.includes('idx_personas_documento_busqueda')),'document query must use the normalized prefix index')
    }finally{db.off('notice',collect);await db.query('SET auto_explain.log_min_duration=-1; SET client_min_messages=notice')}
  })
  const record = async (id, opened=false, results=true, user=2, issued=new Date()) => db.query(
    'SELECT registrar_resultado_busqueda($1,$2,$3,$4,$5,$6)',[user,id,issued,'nombre',results,opened])
  await t.test('outcomes deduplicate races, accept opening before the search beacon and reject ownership conflicts', async () => {
    const id=randomUUID(),issued=new Date(),other=new pg.Client({connectionString});await other.connect()
    try {
      await Promise.all([record(id,false,true,2,issued),other.query('SELECT registrar_resultado_busqueda($1,$2,$3,$4,$5,$6)',[2,id,issued,'nombre',true,true])])
      await record(id,false,true,2,issued)
      const r=(await db.query('SELECT * FROM privado.resultados_busqueda WHERE id=$1',[id])).rows
      assert.equal(r.length,1);assert.equal(r[0].abrio_ficha,true)
      await record(id,false,true,3,issued)
      assert.equal((await db.query('SELECT usuario_id FROM privado.resultados_busqueda WHERE id=$1',[id])).rows[0].usuario_id,2)
    } finally {await other.end()}
    for(const [results,opened] of [[false,true],[null,false],[true,null]]) await assert.rejects(record(randomUUID(),opened,results),/inválido/)
    await assert.rejects(record(randomUUID(),false,true,4),/autorizada/)
    await assert.rejects(record(randomUUID(),false,true,1),/autorizada/)
    await assert.rejects(record(randomUUID(),false,true,2,new Date(Date.now()-31*60000)),/inválido/)
    const cols=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='privado' AND table_name='resultados_busqueda' ORDER BY ordinal_position")).rows.map(r=>r.column_name)
    assert.deepEqual(cols,['id','usuario_id','iniciada_en','tipo','con_resultados','abrio_ficha'])
  })
  await t.test('reports use closed Costa Rica days, member denominators and repeated days; retention and account deletion work', async () => {
    await db.query('DELETE FROM privado.resultados_busqueda')
    const close=(await db.query("SELECT date_trunc('day',clock_timestamp() AT TIME ZONE 'America/Costa_Rica') AT TIME ZONE 'America/Costa_Rica' t")).rows[0].t
    const samples=[ [2,-1,true,true],[2,-2,true,false],[3,-1,false,false],[3,-1,false,false],[3,0,true,true],[2,-8,true,false] ]
    for(const [user,day,results,opened] of samples) await db.query('INSERT INTO privado.resultados_busqueda VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),user,new Date(close.getTime()+day*86400000+1000),'nombre',results,opened])
    const r=(await db.query('SELECT resumen_resultados_busqueda(1,7) r')).rows[0].r
    assert.equal(r.busquedas,4);assert.equal(r.sin_resultados,2);assert.equal(r.con_apertura,1)
    assert.equal(r.miembros,2);assert.equal(r.miembros_con_apertura,1);assert.equal(r.miembros_recurrentes,1)
    await assert.rejects(db.query('SELECT resumen_resultados_busqueda(2,7)'),/autorizada/)
    await assert.rejects(db.query('SELECT resumen_resultados_busqueda(1,8)'),/inválido/)
    await db.query("INSERT INTO privado.resultados_busqueda VALUES($1,2,clock_timestamp()-interval '91 days','documento',false,false)",[randomUUID()])
    await db.query('SELECT limpiar_datos_activacion()')
    assert.equal((await db.query("SELECT count(*)::int n FROM privado.resultados_busqueda WHERE iniciada_en<clock_timestamp()-interval '90 days'")).rows[0].n,0)
    await db.query('DELETE FROM usuarios WHERE id=3')
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.resultados_busqueda WHERE usuario_id=3')).rows[0].n,0)
  })
})
