import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import test from 'node:test';
import mysql from 'mysql2/promise';
import pg from 'pg';
import { existeTablaLegacy } from '../../scripts/legacy-tablas.mjs';

const exec = promisify(execFile);
const docker = async (...args) => (await exec('docker', args)).stdout.trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Only disposable containers are accepted. No DATABASE_URL from the shell or
// .env can select a real database, and every source row below is synthetic.
test('legacy schema → seeded Postgres: complete, repeatable and atomic', { timeout: 180_000 }, async (t) => {
  const suffix = `${process.pid}-${Date.now()}`;
  const mysqlName = `legacy-test-mysql-${suffix}`;
  const pgName = `legacy-test-pg-${suffix}`;
  let source, target;
  t.after(async () => {
    if (source) await source.end();
    if (target) await target.end();
    await Promise.allSettled([docker('rm', '-f', mysqlName), docker('rm', '-f', pgName)]);
  });
  await docker('run', '--rm', '-d', '--name', mysqlName, '-e', 'MYSQL_ALLOW_EMPTY_PASSWORD=yes', '-e', 'MYSQL_DATABASE=legacy_test', '-p', '127.0.0.1::3306', 'mysql:8');
  await docker('run', '--rm', '-d', '--name', pgName, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=import_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine');
  const mysqlPort = Number((await docker('port', mysqlName, '3306')).split(':').pop());
  const pgPort = Number((await docker('port', pgName, '5432')).split(':').pop());
  const deadline = Date.now() + 60_000;
  while (!source) {
    try { source = await mysql.createConnection({ host: '127.0.0.1', port: mysqlPort, user: 'root', database: 'legacy_test', dateStrings: true }); }
    catch (error) { if (Date.now() > deadline) throw error; await sleep(250); }
  }
  target = new pg.Client({ connectionString: `postgres://postgres@127.0.0.1:${pgPort}/import_test` });
  await target.connect();
  const schema = await readFile('legacy/schema.sql', 'utf8');
  const tablas = ['tb_paises', 'tb_provincia', 'tb_canton', 'tb_distrito', 'tb_barrio', 'tb_etiquetainquilino', 'tb_conducta', 'tb_tipoalquiler', 'tb_sexo', 'tb_persona', 'tb_solicitante', 'tb_login', 'tb_permiso', 'tb_ubicacion', 'tb_inquilinos_no_nacionales', 'tb_resenador', 'users'];
  for (const [, nombre, cuerpo] of schema.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\) ENGINE=/g)) {
    if (tablas.includes(nombre)) await source.query(`CREATE TABLE \`${nombre}\` (${cuerpo})`);
  }
  await target.query(await readFile('schema.sql', 'utf8'));
  await target.query(await readFile('db/seeds.sql', 'utf8'));
  await source.query("SET sql_mode = ''");
  await source.query("INSERT INTO tb_paises VALUES (1,'NI','Nicaragua'),(200,'CR','Costa Rica')");
  await source.query("INSERT INTO tb_provincia VALUES (50,1,'San José')");
  await source.query("INSERT INTO tb_canton VALUES (60,50,1,'Central'),(61,50,2,'Otro cantón')");
  await source.query("INSERT INTO tb_distrito VALUES (70,60,1,'Centro'),(71,61,1,'Centro')");
  await source.query("INSERT INTO tb_barrio VALUES (80,70,1,'Barrio prueba')");
  await source.query("INSERT INTO tb_ubicacion VALUES (1000,'San José','Otro cantón','Centro',NULL,NULL)");
  await source.query("INSERT INTO tb_sexo VALUES (12,'Mujer'),(13,'Hombre')");
  await source.query("INSERT INTO tb_etiquetainquilino VALUES (1,'Etiqueta distinta al seed'),(90,'Puntual con pagos')");
  await source.query("INSERT INTO tb_conducta VALUES (1,'Conducta distinta al seed')");
  await source.query("INSERT INTO tb_tipoalquiler VALUES (1,'Apartamento')");
  await source.query(`INSERT INTO tb_persona
    (camp_id_persona,camp_identificacion,camp_nombreUno,camp_apellidoUno,camp_fk_nacionalidad,camp_fk_sexo,camp_fk_domicilio)
    VALUES (1,'101010101','Autor','Duplicado',200,13,NULL),(2,'202020202','Autora','Única',1,12,1000)`);
  await source.query("INSERT INTO tb_resenador (camp_id_resenador,camp_identificacion_resenador) VALUES (500,'202020202')");
  await source.query(`INSERT INTO tb_solicitante (camp_id,camp_cedula,camp_email,camp_nombre,camp_apellido_uno,camp_sexo)
    VALUES (2,'202020202','unique@example.test','Autora','Única',1)`);
  await source.query(`INSERT INTO tb_login (camp_fk_persona,camp_clave,camp_activo,camp_fecha_ingreso)
    VALUES (2,'  clave con espacios  ',1,'2020-02-01')`);
  await source.query(`INSERT INTO users (user_id,firstname,lastname,document,telephone,age,status,date_added,img_user,observaciones,access,id_resenador,resenador,nombre_completo,user_email,user_password_hash)
    VALUES (1,'Autor','Uno','101010101','',50,'activo','2020-01-01','','','propietario','','','','one@example.test','clave123'),
    (2,'Autor','Dos','101010101','',50,'activo','2020-01-01','','','propietario','','','','two@example.test','clave234'),
    (3,'Autora','Única','202020202','',50,'activo','2020-01-01','','','propietario','','','','unique@example.test','clave345')`);
  await source.query(`INSERT INTO tb_inquilinos_no_nacionales
    (camp_id_inquilino,camp_identificacion,camp_nombre,camp_apellido_uno,camp_fk_nacionalidad,camp_nacimiento,camp_fk_sexo,camp_fk_provincia,camp_fk_canton,camp_fk_distrito,camp_fk_barrio,camp_fk_tipo_alquiler,camp_fk_etiqueta_uno,camp_fk_calificacion,camp_fk_conducta,camp_estado,camp_fk_registrador,camp_comentario_adicional,camp_fecha_registro)
    VALUES (10,'303030303','María','Prueba',1,'1980-02-29',12,50,60,70,80,1,1,4,1,1,NULL,'reseña A','2017-02-03 12:00:00'),
    (11,'404040404',NULL,NULL,200,'0000-00-00',NULL,NULL,NULL,NULL,NULL,NULL,90,NULL,NULL,0,1,'reseña B','2017-02-04'),
    (12,NULL,'Juan','Sin cédula',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,99,'reseña C','2017-02-05'),
    (13,'505050505','Ana','Prueba',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,'reseña D','2017-02-06'),
    (14,'606060606','Luis','Prueba',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,500,'reseña E','2017-02-07')`);
  const env = { ...process.env, LEGACY_MYSQL_HOST: '127.0.0.1', LEGACY_MYSQL_PORT: String(mysqlPort), LEGACY_MYSQL_USER: 'root', LEGACY_MYSQL_PASSWORD: '', LEGACY_MYSQL_DB: 'legacy_test', LEGACY_MYSQL_TIMEZONE: '-06:00', DATABASE_URL: `postgres://postgres@127.0.0.1:${pgPort}/import_test`, DATABASE_SSL: 'false', SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_SECRET_KEY: '' };
  const run = async (args = [], overrides = {}) => {
    let r;
    try { r = { code: 0, ...await exec(process.execPath, ['scripts/migrar-legacy.mjs', ...args], { env: { ...env, ...overrides }, maxBuffer: 2 * 1024 * 1024 }) }; }
    catch (error) { r = error; }
    const marker = '=== Resumen ===';
    return { ...r, resumen: r.stdout.includes(marker) ? JSON.parse(r.stdout.split(marker).pop()) : null };
  };
  const snapshot = async (db = target) => (await db.query(`SELECT jsonb_build_object(
    'personas',(SELECT jsonb_agg(p ORDER BY id) FROM personas p),
    'usuarios',(SELECT jsonb_agg(u ORDER BY id) FROM usuarios u),
    'resenas',(SELECT jsonb_agg(r ORDER BY id) FROM resenas r),
    'etiquetas',(SELECT jsonb_agg(e ORDER BY id) FROM etiquetas e),
    'paises',(SELECT jsonb_agg(p ORDER BY id) FROM paises p)) AS datos`)).rows[0].datos;

  await t.test('without tb_persona, imports review identities and preserves unresolved accounts without guessing links', async () => {
    await target.query('CREATE DATABASE import_without_personas');
    const databaseUrl = `postgres://postgres@127.0.0.1:${pgPort}/import_without_personas`;
    const variant = new pg.Client({ connectionString: databaseUrl });
    await variant.connect();
    await variant.query(await readFile('schema.sql', 'utf8'));
    await variant.query(await readFile('db/seeds.sql', 'utf8'));
    await source.query('RENAME TABLE tb_persona TO tb_persona_fuera');
    try {
      assert.equal(await existeTablaLegacy(source, 'tb_persona'), false);
      const antes = await snapshot(variant);
      const simulated = await run(['--seco'], { DATABASE_URL: databaseUrl });
      assert.equal(simulated.code, 0, simulated.stderr);
      assert.equal(simulated.resumen.personas, 6);
      assert.equal(simulated.resumen.resenas, 5);
      assert.ok(simulated.resumen.advertencias.some((a) => a.codigo === 'sin_tb_persona'));
      assert.deepEqual(await snapshot(variant), antes);

      const imported = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(imported.code, 0, imported.stderr);
      assert.equal(imported.resumen.resenas, 5);
      const reviews = (await variant.query(`SELECT r.id_fuente, p.identificacion, p.nombre, u.email, u.activo
        FROM resenas r JOIN personas p ON p.id=r.persona_id JOIN usuarios u ON u.id=r.autor_id
        WHERE r.fuente='legacy' ORDER BY r.id_fuente`)).rows;
      assert.equal(reviews.length, 5);
      assert.equal(reviews[0].identificacion, '303030303');
      assert.equal(reviews[0].nombre, 'María');
      assert.equal(reviews[3].email, 'autor-registrador-2@legacy.laprotec', 'do not assume a registrador is a users.user_id');
      assert.equal(reviews[3].activo, false);
      assert.equal(reviews[4].email, 'unique@example.test', 'tb_resenador still provides an unambiguous author identity');
      const orphan = (await variant.query("SELECT activo, identificacion, persona_id, auth_user_id FROM usuarios WHERE email='login-2@legacy.laprotec'")).rows[0];
      assert.deepEqual(orphan, { activo: false, identificacion: null, persona_id: null, auth_user_id: null });

      const committed = await snapshot(variant);
      const repeated = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(repeated.code, 0, repeated.stderr);
      assert.deepEqual(await snapshot(variant), committed);
    } finally {
      await source.query('RENAME TABLE tb_persona_fuera TO tb_persona');
      await variant.end();
      await target.query('DROP DATABASE import_without_personas');
    }
  });
  await t.test('a hidden tb_persona fails with SELECT permission guidance instead of silently omitting data', async () => {
    await source.query("CREATE USER 'limited_import'@'%' IDENTIFIED BY 'fixture-only'");
    await source.query("GRANT SELECT ON legacy_test.tb_inquilinos_no_nacionales TO 'limited_import'@'%'");
    const reader = await mysql.createConnection({ host: '127.0.0.1', port: mysqlPort, user: 'limited_import', password: 'fixture-only', database: 'legacy_test' });
    const antes = await snapshot();
    try {
      const [visible] = await reader.query("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='tb_persona'");
      assert.equal(visible.length, 0, 'metadata alone cannot distinguish absent tables from denied access');
      await assert.rejects(existeTablaLegacy(reader, 'tb_persona'), /tb_persona.*permisos SELECT/);
      const r = await run(['--seco'], { LEGACY_MYSQL_USER: 'limited_import', LEGACY_MYSQL_PASSWORD: 'fixture-only' });
      assert.equal(r.code, 1);
      assert.match(r.stderr, /tb_persona.*permisos SELECT/);
      assert.equal(r.resumen, null);
      assert.deepEqual(await snapshot(), antes);
    } finally {
      await reader.end();
      await source.query("DROP USER 'limited_import'@'%'");
    }
  });
  await t.test('the review table remains mandatory and a missing table cannot produce a successful empty import', async () => {
    const antes = await snapshot();
    await source.query('RENAME TABLE tb_inquilinos_no_nacionales TO fichas_fuera');
    try {
      const r = await run(['--seco']);
      assert.equal(r.code, 1);
      assert.match(r.stderr, /tabla de fichas tb_inquilinos_no_nacionales/);
      assert.equal(r.resumen, null);
      assert.deepEqual(await snapshot(), antes);
    } finally {
      await source.query('RENAME TABLE fichas_fuera TO tb_inquilinos_no_nacionales');
    }
  });
  await t.test('dry-run checks constraints, counts all reviews and rolls back', async () => {
    const antes = await snapshot();
    const r = await run(['--seco']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.resumen.estado, 'simulacion');
    assert.equal(r.resumen.resenas, 5);
    assert.equal(r.resumen.personas, 7);
    assert.deepEqual(await snapshot(), antes);
  });
  await t.test('imports every review, remaps seeds, normalizes missing names/dates and preserves authors', async () => {
    const r = await run();
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.resumen.resenas, 5);
    const first = (await target.query(`SELECT p.nombre,p.fecha_nacimiento::text,p.sexo,pa.nombre AS pais,
      ta.nombre AS alquiler,e.nombre AS etiqueta,c.nombre AS conducta,r.calificacion_id,r.creado_en::text,u.activo
      FROM resenas r JOIN personas p ON p.id=r.persona_id JOIN paises pa ON pa.id=p.pais_id
      JOIN tipos_alquiler ta ON ta.id=r.tipo_alquiler_id JOIN resena_etiquetas re ON re.resena_id=r.id
      JOIN etiquetas e ON e.id=re.etiqueta_id JOIN resena_conductas rc ON rc.resena_id=r.id
      JOIN conductas c ON c.id=rc.conducta_id JOIN usuarios u ON u.id=r.autor_id
      WHERE r.fuente='legacy' AND r.id_fuente=10`)).rows[0];
    assert.equal(first.pais, 'Nicaragua');
    assert.equal(first.alquiler, 'Apartamento');
    assert.equal(first.etiqueta, 'Etiqueta distinta al seed');
    assert.equal(first.conducta, 'Conducta distinta al seed');
    assert.equal(first.sexo, 'femenino');
    assert.equal(first.fecha_nacimiento, '1980-02-29');
    assert.equal(first.calificacion_id, null, 'absent source catalog must not use seed ID 4');
    assert.equal(first.activo, false);
    assert.match(first.creado_en, /^2017-02-03/);
    assert.equal((await target.query("SELECT nombre FROM etiquetas WHERE id=1")).rows[0].nombre, 'Puntual con pagos');
    const incomplete = (await target.query("SELECT nombre,apellido1,fecha_nacimiento FROM personas WHERE identificacion='404040404'")).rows[0];
    assert.deepEqual(incomplete, { nombre: 'Sin nombre legacy', apellido1: 'Sin apellido legacy', fecha_nacimiento: null });
    assert.equal((await target.query("SELECT count(*)::int AS n FROM usuarios WHERE identificacion='101010101' AND persona_id IS NULL")).rows[0].n, 2);
    const unique = (await target.query("SELECT u.email,r.estado FROM resenas r JOIN usuarios u ON u.id=r.autor_id WHERE r.fuente='legacy' AND r.id_fuente IN (13,14) ORDER BY r.id_fuente")).rows;
    assert.deepEqual(unique, [{ email: 'unique@example.test', estado: 'borrador' }, { email: 'unique@example.test', estado: 'publicada' }]);
    const dom = (await target.query("SELECT c.nombre AS canton,d.nombre AS distrito FROM personas p JOIN cantones c ON c.id=p.canton_id JOIN distritos d ON d.id=p.distrito_id WHERE p.identificacion='202020202'")).rows[0];
    assert.deepEqual(dom, { canton: 'Otro cantón', distrito: 'Centro' });
    assert.ok(r.resumen.advertencias.some((a) => a.codigo === 'referencia_calificaciones'));
  });
  await t.test('rerun preserves IDs and content; selected steps include dependencies', async () => {
    const antes = await snapshot();
    const r = await run(['--pasos=resenas']);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(await snapshot(), antes);
  });
  await t.test('changed legacy tags replace stale imported relationships', async () => {
    await source.query('UPDATE tb_inquilinos_no_nacionales SET camp_fk_etiqueta_uno=90 WHERE camp_id_inquilino=10');
    const r = await run();
    assert.equal(r.code, 0, r.stderr);
    const tags = (await target.query("SELECT e.nombre FROM resena_etiquetas re JOIN etiquetas e ON e.id=re.etiqueta_id JOIN resenas r ON r.id=re.resena_id WHERE r.fuente='legacy' AND r.id_fuente=10")).rows;
    assert.deepEqual(tags, [{ nombre: 'Puntual con pagos' }]);
  });
  await t.test('late database failure rolls back people, catalogs and reviews, including dry-run', async () => {
    await target.query("ALTER TABLE resenas ADD CONSTRAINT test_failure CHECK (comentario <> 'FAIL')");
    await source.query("INSERT INTO tb_etiquetainquilino VALUES (100,'Must roll back')");
    await source.query("UPDATE tb_inquilinos_no_nacionales SET camp_nombre='Changed',camp_comentario_adicional='FAIL' WHERE camp_id_inquilino=14");
    const antes = await snapshot();
    for (const args of [[], ['--seco']]) {
      const r = await run(args);
      assert.equal(r.code, 1);
      assert.match(r.stderr, /No se guardaron/);
      assert.equal(r.resumen, null);
      assert.deepEqual(await snapshot(), antes);
    }
    await target.query('ALTER TABLE resenas DROP CONSTRAINT test_failure');
    await source.query("UPDATE tb_inquilinos_no_nacionales SET camp_nombre='Luis',camp_comentario_adicional='reseña E' WHERE camp_id_inquilino=14");
    await source.query('DELETE FROM tb_etiquetainquilino WHERE camp_id_etiquetaInquilino=100');
  });
  await t.test('database lock rejects a competing importer', async () => {
    await target.query('BEGIN');
    await target.query('SELECT pg_advisory_xact_lock(736284,1)');
    try {
      const r = await run();
      assert.equal(r.code, 1);
      assert.match(r.stderr, /importación en curso/);
    } finally { await target.query('ROLLBACK'); }
  });
  await t.test('conflicting identities for a shared email fail without changing the destination', async () => {
    const antes = await snapshot();
    await source.query("UPDATE users SET user_email='one@example.test',document='999999999' WHERE user_id=2");
    try {
      const r = await run();
      assert.equal(r.code, 1);
      assert.match(r.stderr, /correo compartido/);
      assert.deepEqual(await snapshot(), antes);
    } finally {
      await source.query("UPDATE users SET user_email='two@example.test',document='101010101' WHERE user_id=2");
    }
  });
  await t.test('an incompatible source column fails even before importing rows', async () => {
    const antes = await snapshot();
    await source.query('ALTER TABLE tb_inquilinos_no_nacionales RENAME COLUMN camp_estado TO estado_incompatible');
    try {
      const r = await run(['--seco']);
      assert.equal(r.code, 1);
      assert.match(r.stderr, /camp_estado/);
      assert.deepEqual(await snapshot(), antes);
    } finally {
      await source.query('ALTER TABLE tb_inquilinos_no_nacionales RENAME COLUMN estado_incompatible TO camp_estado');
    }
  });
  await t.test('6,500 additional reviews use bounded batches and a dry-run leaves no rows behind', async () => {
    const antes = await snapshot();
    for (let start = 0; start < 6500; start += 500) {
      const rows = Array.from({ length: 500 }, (_, i) => [10000 + start + i, `VOLUME-${start + i}`, 'Prueba', 'Volumen', 1]);
      await source.query(`INSERT INTO tb_inquilinos_no_nacionales
        (camp_id_inquilino,camp_identificacion,camp_nombre,camp_apellido_uno,camp_estado) VALUES ?`, [rows]);
    }
    try {
      const inicio = performance.now();
      const r = await run(['--seco']);
      assert.equal(r.code, 0, r.stderr);
      assert.equal(r.resumen.resenas, 6505);
      assert.equal(r.resumen.personas, 6507);
      assert.deepEqual(await snapshot(), antes);
      t.diagnostic(`6,505 reviews validated locally in ${((performance.now() - inicio) / 1000).toFixed(2)}s`);
    } finally { await source.query('DELETE FROM tb_inquilinos_no_nacionales WHERE camp_id_inquilino >= 10000'); }
  });
  await t.test('Auth failures are partial, retryable and limited to imported accounts', async () => {
    await target.query('CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT NULL::text$$; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text UNIQUE)');
    await target.query("INSERT INTO usuarios (email,nombre) VALUES ('unrelated@example.test','Existing')");
    const requests = [];
    let rejectTwo = true;
    const server = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (body.email === 'unique@example.test') assert.equal(body.password, '  clave con espacios  ');
      requests.push(body.email);
      res.setHeader('Content-Type', 'application/json');
      if (rejectTwo && body.email === 'two@example.test') {
        res.statusCode = 422;
        res.end(JSON.stringify({ msg: 'Fixture rejection' }));
        return;
      }
      const id = `00000000-0000-4000-8000-${String(requests.length).padStart(12, '0')}`;
      await target.query('INSERT INTO auth.users VALUES ($1,$2)', [id, body.email]);
      res.end(JSON.stringify({ id, email: body.email, aud: 'authenticated', role: 'authenticated' }));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const authEnv = { SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SECRET_KEY: 'test-only-key' };
      const first = await run(['--crear-accounts'], authEnv);
      assert.equal(first.code, 2, first.stderr);
      assert.equal(first.resumen.estado, 'parcial');
      assert.equal(first.resumen.auth.fallidas, 1);
      assert.equal((await target.query("SELECT count(*)::int AS n FROM resenas WHERE fuente='legacy'")).rows[0].n, 5);
      rejectTwo = false;
      const second = await run(['--crear-accounts'], authEnv);
      assert.equal(second.code, 0, second.stderr);
      assert.equal(second.resumen.estado, 'completada');
      assert.equal((await target.query("SELECT count(*)::int AS n FROM usuarios WHERE auth_user_id IS NOT NULL")).rows[0].n, 3);
      assert.deepEqual(requests.sort(), ['one@example.test', 'two@example.test', 'two@example.test', 'unique@example.test']);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });
});
