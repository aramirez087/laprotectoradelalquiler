import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import test from 'node:test'
import pg from 'pg'

const exec = promisify(execFile)
const docker = async (...args) => (await exec('docker', args)).stdout.trim()
const texto = 'Pagó a tiempo y devolvió la propiedad en buen estado.'
const datos = { identificacion: '102340567', nombre: 'Ana', nombre2: '', apellido1: 'Solís', apellido2: '', comentario: texto, anonima: true }

// No environment files or production connections. Every query targets disposable Postgres.
test('private drafts, transactional notices and account cohorts', { timeout: 120_000 }, async t => {
  const container = `activacion-test-${process.pid}-${Date.now()}`
  let db
  t.after(async () => { await db?.end(); await docker('rm', '-f', container) })
  await docker('run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '-e', 'POSTGRES_DB=activacion_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine')
  const port = Number((await docker('port', container, '5432')).split(':').pop())
  const connectionString = `postgres://postgres@127.0.0.1:${port}/activacion_test`
  const deadline = Date.now()+30_000
  while (!db) {
    const candidate = new pg.Client({ connectionString })
    try { await candidate.connect(); db = candidate }
    catch (error) { await candidate.end(); if (Date.now()>deadline) throw error; await new Promise(r => setTimeout(r,200)) }
  }
  await db.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true),'') $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;`)
  const completo = await readFile('schema.sql','utf8')
  const busqueda = await readFile('db/busqueda-relevante.sql','utf8')
  assert.ok(completo.endsWith(busqueda))
  const schema = completo.slice(0, completo.length - busqueda.length).trimEnd() + '\n'
  const migration = await readFile('db/activacion.sql','utf8')
  assert.ok(schema.endsWith(migration), 'fresh installs and additive upgrades agree')
  await db.query(schema.slice(0,schema.length-migration.length))
  await db.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;`)
  const seed = async () => {
    await db.query(`RESET ROLE; TRUNCATE usuarios,personas,resenas RESTART IDENTITY CASCADE;
      INSERT INTO usuarios(email,nombre,rol,auth_user_id) VALUES
        ('author@example.test','Author','propietario','00000000-0000-0000-0000-000000000001'),
        ('admin@example.test','Admin','admin','00000000-0000-0000-0000-000000000002'),
        ('other@example.test','Other','agencia','00000000-0000-0000-0000-000000000003');
      INSERT INTO personas(identificacion,nombre,apellido1) VALUES ('102340567','Ana','Solís'),('204560789','Luis','Mora');`)
  }
  const save = async (version=null, contenido=datos, client=db, autor=1, persona=null) => (await client.query(
    'SELECT * FROM guardar_borrador_resena($1,$2,$3,$4)',[autor,persona,version,contenido])).rows[0]
  const draft = async (autor=1) => (await db.query('SELECT * FROM leer_borrador_resena($1,NULL)',[autor])).rows[0]
  const insertReview = () => db.query("INSERT INTO resenas(persona_id,autor_id,comentario,estado) VALUES(1,1,$1,'borrador')",[texto])
  const claim = async (client=db) => (await client.query('SELECT * FROM reclamar_avisos_moderacion(5)')).rows
  const role = async (name, fn) => { await db.query(`SET ROLE ${name}`); try { return await fn() } finally { await db.query('RESET ROLE') } }

  await t.test('upgrade is additive, repeatable and never backfills or emails old reviews', async () => {
    await seed(); await insertReview()
    await db.query("UPDATE resenas SET estado='publicada'")
    const before = (await db.query('SELECT * FROM resenas')).rows
    await db.query(migration); const start = (await db.query('SELECT iniciada_en FROM privado.activacion_config')).rows[0]
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.activacion_cuentas')).rows[0].n,0)
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.avisos_moderacion')).rows[0].n,0)
    await db.query(migration)
    assert.deepEqual((await db.query('SELECT iniciada_en FROM privado.activacion_config')).rows[0],start)
    assert.deepEqual((await db.query('SELECT * FROM resenas')).rows,before)
  })
  await t.test('drafts are owned, versioned, bounded and private to the server', async () => {
    await seed()
    const initial = await role('service_role',()=>save())
    assert.ok(initial.guardado && initial.version)
    assert.deepEqual((await draft()).datos,datos)
    assert.equal(await draft(3),undefined)
    const next = await save(initial.version,{...datos,comentario:'Updated draft'})
    assert.equal(next.guardado,true)
    assert.equal((await save(initial.version)).guardado,false)
    for (const invalid of [{...datos,comentario:'x'.repeat(5001)},{...datos,extra:'private'}, {...datos,anonima:'true'}]) {
      await assert.rejects(save(next.version,invalid),/inválido/)
    }
    await db.query('UPDATE usuarios SET activo=false WHERE id=1')
    await assert.rejects(save(next.version),/Cuenta/)
    await assert.rejects(draft(),/Cuenta/)
    for (const name of ['anon','authenticated']) await role(name,async () => {
      await assert.rejects(save(),/permission denied/)
      await assert.rejects(draft(),/permission denied/)
      await assert.rejects(db.query('SELECT * FROM privado.borradores_resena'),/permission denied/)
      await assert.rejects(db.query('SELECT * FROM resumen_activacion(2,7)'),/permission denied/)
    })
  })
  await t.test('simultaneous saves cannot overwrite each other', async () => {
    await seed()
    const initial = await save()
    const other = new pg.Client({connectionString}); await other.connect()
    try {
      const results = await Promise.all([save(initial.version,{...datos,comentario:'Tab A'}),save(initial.version,{...datos,comentario:'Tab B'},other)])
      assert.equal(results.filter(r=>r.guardado).length,1)
      assert.ok(['Tab A','Tab B'].includes((await draft()).datos.comentario))
    } finally { await other.end() }
  })
  await t.test('submission clears its draft atomically and rejects late autosaves', async () => {
    await seed(); const initial = await save(); await insertReview()
    assert.equal((await draft()).datos,null)
    assert.notEqual((await draft()).version,initial.version)
    assert.equal((await save(initial.version)).guardado,false)
    const after = await save((await draft()).version,{...datos,identificacion:'204560789',nombre:'Luis'})
    assert.equal(after.guardado,true)
    await db.query('BEGIN'); await db.query("INSERT INTO resenas(persona_id,autor_id,comentario) VALUES(2,1,$1)",[texto]); await db.query('ROLLBACK')
    assert.equal((await draft()).datos.nombre,'Luis','failed submission must retain the draft')
    await db.query("UPDATE privado.borradores_resena SET actualizado_en=clock_timestamp()-interval '31 days'")
    assert.equal((await draft()).datos,null,'expired content must never be returned')
    await db.query('SELECT limpiar_datos_activacion()')
    assert.equal((await db.query('SELECT datos FROM privado.borradores_resena')).rows[0].datos,null)
  })
  await t.test('milestones occur once; old accounts and admins stay out; access gates searches', async () => {
    await seed()
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.activacion_cuentas')).rows[0].n,2)
    await db.query("INSERT INTO usuarios(email,nombre,rol,auth_user_id,creado_en) VALUES('old@example.test','Old','propietario',gen_random_uuid(),'2020-01-01')")
    await insertReview()
    await db.query('SELECT registrar_primera_consulta(1)')
    assert.equal((await db.query('SELECT primera_consulta_en FROM privado.activacion_cuentas WHERE usuario_id=1')).rows[0].primera_consulta_en,null)
    await db.query("UPDATE resenas SET estado='publicada' WHERE id=1")
    await db.query('SELECT registrar_primera_consulta(1)')
    const first = (await db.query('SELECT * FROM privado.activacion_cuentas WHERE usuario_id=1')).rows[0]
    assert.ok(first.primera_resena_en && first.primera_aprobacion_en && first.primera_consulta_en)
    await db.query('SELECT registrar_primera_consulta(1)')
    assert.deepEqual((await db.query('SELECT * FROM privado.activacion_cuentas WHERE usuario_id=1')).rows[0],first)
    await db.query("UPDATE resenas SET estado='oculta'; UPDATE resenas SET estado='publicada'")
    assert.equal((await db.query('SELECT primera_aprobacion_en FROM privado.activacion_cuentas WHERE usuario_id=1')).rows[0].primera_aprobacion_en.getTime(),first.primera_aprobacion_en.getTime())
    await assert.rejects(db.query('SELECT resumen_activacion(1,7)'),/Administración/)
    await assert.rejects(db.query('SELECT resumen_activacion(2,9)'),/Período/)
    await db.query("UPDATE privado.activacion_cuentas SET creada_en=date_trunc('day',clock_timestamp())-interval '2 days'")
    const report=(await db.query('SELECT resumen_activacion(2,7) r')).rows[0].r
    assert.equal(report.cuentas,2); assert.equal(report.enviaron,1); assert.equal(report.aprobadas,1); assert.equal(report.consultaron,1)
    assert.equal(report.maduras,0)
    await db.query("UPDATE privado.activacion_cuentas SET creada_en=clock_timestamp()-interval '10 days',primera_consulta_en=clock_timestamp()-interval '9 days' WHERE usuario_id=1")
    const mature=(await db.query('SELECT resumen_activacion(2,7) r')).rows[0].r
    assert.equal(mature.maduras,1); assert.equal(mature.activadas_7d,1)
  })
  await t.test('moderation and notifications commit together; stale decisions and invalid addresses are skipped', async () => {
    await seed(); await insertReview()
    await db.query('BEGIN'); await db.query("UPDATE resenas SET estado='publicada'"); await db.query('ROLLBACK')
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.avisos_moderacion')).rows[0].n,0)
    await db.query("UPDATE resenas SET estado='oculta',permite_correccion=true,detalle_verificacion='Precise los hechos'")
    assert.equal((await db.query('SELECT accion FROM privado.avisos_moderacion')).rows[0].accion,'corregir')
    await db.query("UPDATE resenas SET estado='publicada',permite_correccion=false")
    const claimed=await claim(); assert.equal(claimed.length,1); assert.equal(claimed[0].accion,'aprobada')
    assert.equal((await db.query("SELECT count(*)::int n FROM privado.avisos_moderacion WHERE estado='omitida'")).rows[0].n,1)
    await db.query("UPDATE resenas SET estado='oculta'; UPDATE usuarios SET email='erased@cuentas.invalid' WHERE id=1")
    assert.equal((await claim()).length,0)
  })
  await t.test('workers claim exclusively, preserve payload and key, recover leases and stop uncertain sends after 23h', async () => {
    await seed(); await insertReview(); await db.query("UPDATE resenas SET estado='publicada'")
    const other=new pg.Client({connectionString}); await other.connect()
    try {
      const batches=await Promise.all([claim(),claim(other)])
      assert.equal(batches.flat().length,1)
      const aviso=batches.flat()[0]
      const payload={from:'sender@example.test',to:['author@example.test'],subject:'Approved',text:'Safe message'}
      const prepare=(token,cuerpo)=>db.query('SELECT preparar_aviso_moderacion($1,$2,$3) cuerpo',[aviso.id,token,cuerpo])
      assert.equal((await prepare('00000000-0000-0000-0000-000000000000',payload)).rows[0].cuerpo,null)
      assert.deepEqual((await prepare(aviso.token,payload)).rows[0].cuerpo,payload)
      await db.query("UPDATE privado.avisos_moderacion SET proximo_intento_en=clock_timestamp()-interval '1 minute'")
      const recovered=(await claim())[0]; assert.equal(recovered.id,aviso.id); assert.notEqual(recovered.token,aviso.token)
      assert.deepEqual((await prepare(recovered.token,{...payload,subject:'Changed'})).rows[0].cuerpo,payload)
      await db.query("SELECT finalizar_aviso_moderacion($1,$2,'enviada','fake-provider-id')",[aviso.id,aviso.token])
      assert.equal((await db.query('SELECT estado FROM privado.avisos_moderacion')).rows[0].estado,'procesando')
      await db.query("SELECT finalizar_aviso_moderacion($1,$2,'pendiente',NULL)",[aviso.id,recovered.token])
      assert.equal((await claim()).length,0,'backoff is respected')
      await db.query("UPDATE privado.avisos_moderacion SET primer_intento_en=clock_timestamp()-interval '24 hours',proximo_intento_en=clock_timestamp()")
      assert.equal((await claim()).length,0)
    assert.equal((await db.query('SELECT estado FROM privado.avisos_moderacion')).rows[0].estado,'revision')
      const report=(await db.query('SELECT resumen_avisos_moderacion(2) r')).rows[0].r
      assert.equal(report.revision,1);assert.equal(report.detalle_revision[0].id,aviso.id)
      assert.doesNotMatch(JSON.stringify(report),/author@example|Frozen|Safe message/)
    } finally {await other.end()}
  })
  await t.test('account deletion removes its private drafts, milestones and recipient snapshots',async()=>{
    await seed(); await save(); await insertReview(); await db.query("UPDATE resenas SET estado='publicada'; DELETE FROM usuarios WHERE id=1")
    for(const table of ['borradores_resena','avisos_moderacion']) assert.equal((await db.query(`SELECT count(*)::int n FROM privado.${table}`)).rows[0].n,0)
    assert.equal((await db.query('SELECT count(*)::int n FROM privado.activacion_cuentas WHERE usuario_id=1')).rows[0].n,0)
  })
  await t.test('scheduler SQL is private, idempotent and keeps credentials out of job commands',async()=>{
    // Contract fixtures for the three Supabase extensions. No real HTTP or mail;
    // extension installation and production execution are rollout checks.
    await db.query(`CREATE SCHEMA cron; CREATE SCHEMA net; CREATE SCHEMA vault;
      CREATE TABLE cron.job(jobid bigserial PRIMARY KEY,jobname text UNIQUE,schedule text,command text,active boolean DEFAULT true);
      CREATE TABLE cron.job_run_details(jobid bigint,end_time timestamptz);
      CREATE TABLE vault.secrets(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,name text UNIQUE,secret text,description text);
      CREATE VIEW vault.decrypted_secrets AS SELECT id,name,secret AS decrypted_secret FROM vault.secrets;
      CREATE FUNCTION vault.create_secret(secret text,name text,description text) RETURNS uuid LANGUAGE sql AS $$
        INSERT INTO vault.secrets(secret,name,description) VALUES($1,$2,$3) RETURNING id $$;
      CREATE FUNCTION vault.update_secret(id uuid,secret text,name text,description text) RETURNS void LANGUAGE sql AS $$
        UPDATE vault.secrets SET secret=$2,name=$3,description=$4 WHERE id=$1 $$;
      CREATE FUNCTION cron.schedule(name text,schedule text,command text) RETURNS bigint LANGUAGE sql AS $$
        INSERT INTO cron.job(jobname,schedule,command) VALUES($1,$2,$3) ON CONFLICT(jobname) DO UPDATE
        SET schedule=excluded.schedule,command=excluded.command,active=true RETURNING jobid $$;
      CREATE TABLE net.http_request_queue(id bigserial PRIMARY KEY,url text,headers jsonb,timeout_milliseconds integer);
      CREATE TABLE net._http_response(id bigint);
      CREATE FUNCTION net.http_get(url text,params jsonb DEFAULT '{}',headers jsonb DEFAULT '{}',timeout_milliseconds integer DEFAULT 1000)
        RETURNS bigint LANGUAGE sql AS $$ INSERT INTO net.http_request_queue(url,headers,timeout_milliseconds) VALUES($1,$3,$4) RETURNING id $$;
      GRANT USAGE ON SCHEMA net TO anon,authenticated;
      GRANT SELECT ON net.http_request_queue,net._http_response TO PUBLIC;`)
    const secret='a'.repeat(43)
    const options={env:{...process.env,DATABASE_URL:connectionString,DATABASE_SSL:'false',CRON_SECRET:secret},timeout:15000}
    const preview=await exec(process.execPath,['scripts/configurar-avisos-cron.mjs'],options)
    assert.match(preview.stdout,/Vista previa/)
    assert.equal((await db.query('SELECT count(*)::int n FROM cron.job')).rows[0].n,0)
    for(let i=0;i<2;i++) {
      const applied=await exec(process.execPath,['scripts/configurar-avisos-cron.mjs','--aplicar'],options)
      assert.doesNotMatch(applied.stdout+applied.stderr,new RegExp(secret))
    }
    const jobs=(await db.query('SELECT * FROM cron.job')).rows
    assert.equal(jobs.length,1);assert.equal(jobs[0].schedule,'*/5 * * * *')
    assert.equal(jobs[0].command,'SELECT privado.despertar_worker_avisos();')
    await db.query(`INSERT INTO cron.job(jobname,schedule,command) VALUES('other','0 0 * * *','SELECT 1');
      INSERT INTO cron.job_run_details SELECT jobid,clock_timestamp()-interval '10 days' FROM cron.job;`)
    await seed()
    assert.equal((await db.query('SELECT privado.despertar_worker_avisos() r')).rows[0].r,null)
    assert.equal((await db.query('SELECT count(*)::int n FROM cron.job_run_details')).rows[0].n,1,'other jobs retain their history')
    await insertReview();await db.query("UPDATE resenas SET estado='publicada'")
    assert.ok((await db.query('SELECT privado.despertar_worker_avisos() r')).rows[0].r)
    const request=(await db.query('SELECT * FROM net.http_request_queue')).rows[0]
    assert.equal(request.url,'https://www.protectoradelalquiler.com/api/avisos')
    assert.equal(request.headers.Authorization,`Bearer ${secret}`)
    assert.equal(request.timeout_milliseconds,180000)
    for(const name of ['anon','authenticated','service_role']) await role(name,async()=>{
      await assert.rejects(db.query('SELECT privado.despertar_worker_avisos()'),/permission denied/)
      await assert.rejects(db.query('SELECT * FROM net.http_request_queue'),/permission denied/)
    })
    await db.query('DELETE FROM vault.secrets')
    await assert.rejects(db.query('SELECT privado.despertar_worker_avisos()'),/Falta el secreto/)
    assert.equal((await db.query('SELECT count(*)::int n FROM net.http_request_queue')).rows[0].n,1)
    const failed=await exec(process.execPath,['scripts/configurar-avisos-cron.mjs','--wrong'],options).catch(e=>e)
    assert.equal(failed.code,1);assert.doesNotMatch(failed.stdout+failed.stderr,new RegExp(secret))
  })
})
