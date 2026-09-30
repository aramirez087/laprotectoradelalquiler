import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import test from 'node:test';
import mysql from 'mysql2/promise';
import pg from 'pg';
import { existeTablaLegacy } from '../../scripts/legacy-tablas.mjs';
import { resumenDesdeSalida } from '../../lib/resultado-migracion-legacy.ts';

const exec = promisify(execFile);
const docker = async (...args) => (await exec('docker', args)).stdout.trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Only disposable containers are accepted. No DATABASE_URL from the shell or
// .env can select a real database, and every source row below is synthetic.
test('legacy schema → seeded Postgres: complete, repeatable and atomic', { timeout: 240_000 }, async (t) => {
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
    return { ...r, resumen: r.stdout.includes(marker) ? resumenDesdeSalida(r.stdout, r.code) : null };
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
      await source.query(`INSERT INTO tb_inquilinos_no_nacionales
        (camp_id_inquilino,camp_identificacion,camp_fk_registrador,camp_comentario_adicional,camp_fecha_registro,camp_estado)
        VALUES (15,'404040404',1,'última ficha de autor sin persona','2018-01-01 12:00:00',0)`);
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
      assert.deepEqual(imported.resumen.fichas, { leidas: 6, archivadas: 6, consolidadas: 1, conservadas: 0 });
      const reviews = (await variant.query(`SELECT r.id_fuente, p.identificacion, p.nombre, u.email, u.activo
        FROM resenas r JOIN personas p ON p.id=r.persona_id JOIN usuarios u ON u.id=r.autor_id
        WHERE r.fuente='legacy' ORDER BY r.id_fuente`)).rows;
      assert.equal(reviews.length, 5);
      assert.equal(reviews[0].identificacion, '303030303');
      assert.equal(reviews[0].nombre, 'María');
      assert.equal(reviews.find((r) => r.id_fuente === 13).email, 'autor-registrador-2@legacy.laprotec', 'do not assume a registrador is a users.user_id');
      assert.equal(reviews.find((r) => r.id_fuente === 13).activo, false);
      assert.equal(reviews.find((r) => r.id_fuente === 14).email, 'unique@example.test', 'tb_resenador still provides an unambiguous author identity');
      const unresolved = (await variant.query(`SELECT r.id,r.id_fuente,r.comentario,u.email,u.activo
        FROM resenas r JOIN personas p ON p.id=r.persona_id JOIN usuarios u ON u.id=r.autor_id
        WHERE r.fuente='legacy' AND p.identificacion='404040404'`)).rows;
      assert.equal(unresolved.length, 1);
      assert.equal(unresolved[0].id_fuente, 15);
      assert.equal(unresolved[0].comentario, 'última ficha de autor sin persona');
      assert.equal(unresolved[0].email, 'autor-registrador-1@legacy.laprotec');
      assert.equal(unresolved[0].activo, false);
      const unresolvedOriginals = (await variant.query(`SELECT id_fuente,resena_id FROM privado.resenas_legacy_originales
        WHERE id_fuente IN (11,15) ORDER BY id_fuente`)).rows;
      assert.deepEqual(unresolvedOriginals, [
        { id_fuente: 11, resena_id: unresolved[0].id }, { id_fuente: 15, resena_id: unresolved[0].id },
      ]);
      const orphan = (await variant.query("SELECT activo, identificacion, persona_id, auth_user_id FROM usuarios WHERE email='login-2@legacy.laprotec'")).rows[0];
      assert.deepEqual(orphan, { activo: false, identificacion: null, persona_id: null, auth_user_id: null });

      const committed = await snapshot(variant);
      const repeated = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(repeated.code, 0, repeated.stderr);
      assert.deepEqual(await snapshot(variant), committed);
    } finally {
      await source.query('DELETE FROM tb_inquilinos_no_nacionales WHERE camp_id_inquilino=15');
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
  await t.test('repeated owner/person fichas keep the latest review and archive every source version', async () => {
    await target.query('CREATE DATABASE import_duplicate_reviews');
    const databaseUrl = `postgres://postgres@127.0.0.1:${pgPort}/import_duplicate_reviews`;
    const variant = new pg.Client({ connectionString: databaseUrl });
    await variant.connect();
    const [sourceSettings] = await source.query('SELECT @@session.time_zone AS timeZone');
    const archived = async () => (await variant.query(`SELECT id_fuente,huella,datos,resena_id,archivado_en
      FROM privado.resenas_legacy_originales ORDER BY id_fuente,huella`)).rows;
    const completeSnapshot = async () => ({
      data: await snapshot(variant),
      archive: await archived(),
      tags: (await variant.query('SELECT * FROM resena_etiquetas ORDER BY resena_id,etiqueta_id')).rows,
      conduct: (await variant.query('SELECT * FROM resena_conductas ORDER BY resena_id,conducta_id')).rows,
      approvals: (await variant.query('SELECT * FROM privado.aportes_consulta ORDER BY resena_id')).rows,
    });
    const canonical = async () => (await variant.query(`SELECT r.* FROM resenas r
      JOIN personas p ON p.id=r.persona_id WHERE p.identificacion='606060606'`)).rows[0];
    const relationships = async (id) => ({
      tags: (await variant.query(`SELECT e.nombre FROM resena_etiquetas re
        JOIN etiquetas e ON e.id=re.etiqueta_id WHERE re.resena_id=$1 ORDER BY e.nombre`, [id])).rows,
      conduct: (await variant.query(`SELECT c.nombre FROM resena_conductas rc
        JOIN conductas c ON c.id=rc.conducta_id WHERE rc.resena_id=$1 ORDER BY c.nombre`, [id])).rows,
    });
    try {
      await variant.query(await readFile('schema.sql', 'utf8'));
      await variant.query(await readFile('db/seeds.sql', 'utf8'));
      // An existing installation has the pair constraint but not the new archive.
      await variant.query('DROP TABLE IF EXISTS privado.resenas_legacy_originales');
      await source.query("SET time_zone = '-06:00'");
      await source.query("INSERT INTO tb_conducta VALUES (91,'Conducta de la ficha reciente')");
      await source.query(`INSERT INTO tb_inquilinos_no_nacionales
        (camp_id_inquilino,camp_identificacion,camp_nombre,camp_apellido_uno,camp_fk_registrador,
         camp_comentario_adicional,camp_fecha_registro,camp_estado,camp_fk_etiqueta_uno,camp_fk_conducta,camp_calificacion_text)
        VALUES (20,'606060606','Luis','Prueba',2,'mismo día, id menor','2022-01-01 12:00:00',1,1,1,'raw field 20'),
        (21,'606060606','Luis','Prueba',500,'última válida','2022-01-01 12:00:00',1,90,91,'raw field 21'),
        (22,'606060606','Luis','Prueba',2,'fecha inválida','0000-00-00 00:00:00',1,1,1,'raw field 22'),
        (23,'606060606','Luis','Prueba',500,'fecha anterior','2021-01-01 12:00:00',1,1,1,'raw field 23')`);

      const before = await snapshot(variant);
      const dry = await run(['--seco'], { DATABASE_URL: databaseUrl });
      assert.equal(dry.code, 0, dry.stderr);
      assert.equal(dry.resumen.resenas, 5);
      assert.deepEqual(dry.resumen.fichas, { leidas: 9, archivadas: 9, consolidadas: 4, conservadas: 0 });
      assert.deepEqual(await snapshot(variant), before);
      assert.equal((await variant.query("SELECT to_regclass('privado.resenas_legacy_originales') AS tabla")).rows[0].tabla, null,
        'creating the archive is part of the rolled-back dry-run transaction');

      const imported = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(imported.code, 0, imported.stderr);
      assert.equal(imported.resumen.resenas, 5);
      assert.deepEqual(imported.resumen.fichas, { leidas: 9, archivadas: 9, consolidadas: 4, conservadas: 0 });
      const latest = await canonical();
      assert.equal(latest.id_fuente, 21, 'latest valid date wins, then greatest source ID');
      assert.equal(latest.comentario, 'última válida');
      assert.deepEqual(await relationships(latest.id), {
        tags: [{ nombre: 'Puntual con pagos' }],
        conduct: [{ nombre: 'Conducta de la ficha reciente' }],
      });
      const [raw] = await source.query('SELECT * FROM tb_inquilinos_no_nacionales ORDER BY camp_id_inquilino');
      const originals = await archived();
      assert.equal(originals.length, 9);
      for (const row of raw) {
        const saved = originals.find((r) => r.id_fuente === row.camp_id_inquilino);
        assert.ok(saved, `archive source ID ${row.camp_id_inquilino}`);
        assert.deepEqual(saved.datos, { ...row }, 'archive includes every source column, even unused fields');
        assert.ok(saved.resena_id, 'each original links to its canonical review');
      }
      assert.deepEqual(originals.filter((r) => [14,20,21,22,23].includes(r.id_fuente)).map((r) => r.resena_id),
        Array(5).fill(latest.id), 'group only after different registradores resolve to the same author');
      assert.equal((await variant.query(`SELECT count(*)::int AS n FROM (
        SELECT autor_id,persona_id FROM resenas GROUP BY autor_id,persona_id HAVING count(*)>1
      ) duplicadas`)).rows[0].n, 0);
      const committed = await completeSnapshot();
      const repeated = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(repeated.code, 0, repeated.stderr);
      assert.deepEqual(await completeSnapshot(), committed, 'unchanged reruns add no archive versions or review IDs');

      await source.query(`UPDATE tb_inquilinos_no_nacionales SET camp_fecha_registro='2024-01-01 12:00:00',
        camp_comentario_adicional='nuevo último original',camp_calificacion_text='raw field 23 revised'
        WHERE camp_id_inquilino=23`);
      const changed = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(changed.code, 0, changed.stderr);
      const revised = await canonical();
      assert.equal(revised.id, latest.id, 'changing the winning source row keeps the canonical review ID');
      assert.equal(revised.id_fuente, 23);
      assert.equal(revised.comentario, 'nuevo último original');
      assert.deepEqual(await relationships(revised.id), {
        tags: [{ nombre: 'Etiqueta distinta al seed' }],
        conduct: [{ nombre: 'Conducta distinta al seed' }],
      });
      const versions = await archived();
      assert.equal(versions.length, 10, 'only a changed original adds a version');
      assert.deepEqual(versions.filter((r) => r.id_fuente === 23).map((r) => r.datos.camp_calificacion_text).sort(),
        ['raw field 23', 'raw field 23 revised']);
      assert.ok(versions.filter((r) => [14,20,21,22,23].includes(r.id_fuente)).every((r) => r.resena_id === latest.id));

      // A changed nonwinning original creates a new pair without rewriting the
      // historical link of the already archived version for the old person.
      await source.query(`UPDATE tb_inquilinos_no_nacionales
        SET camp_identificacion='808080808',camp_fecha_registro='2022-01-01 12:00:00' WHERE camp_id_inquilino=20`);
      const movedOriginal = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(movedOriginal.code, 0, movedOriginal.stderr);
      assert.equal(movedOriginal.resumen.resenas, 6);
      const newPair = (await variant.query(`SELECT r.id,p.identificacion FROM resenas r
        JOIN personas p ON p.id=r.persona_id WHERE r.fuente='legacy' AND r.id_fuente=20`)).rows[0];
      assert.equal(newPair.identificacion, '808080808');
      assert.notEqual(newPair.id, latest.id);
      const movedVersions = (await archived()).filter((r) => r.id_fuente === 20);
      assert.equal(movedVersions.length, 2);
      assert.equal(movedVersions.find((r) => r.datos.camp_identificacion === '606060606').resena_id, latest.id);
      assert.equal(movedVersions.find((r) => r.datos.camp_identificacion === '808080808').resena_id, newPair.id);
      const afterMove = await completeSnapshot();
      await source.query(`UPDATE tb_inquilinos_no_nacionales
        SET camp_identificacion='909090909',camp_fecha_registro='2022-01-01 12:00:00' WHERE camp_id_inquilino=20`);
      const unsafeMove = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(unsafeMove.code, 1, 'an already canonical source cannot silently move to another person');
      assert.match(unsafeMove.stderr, /cambió de propietario o persona/);
      assert.deepEqual(await completeSnapshot(), afterMove);
      await source.query(`UPDATE tb_inquilinos_no_nacionales
        SET camp_identificacion='808080808',camp_fecha_registro='2022-01-01 12:00:00' WHERE camp_id_inquilino=20`);

      // Imported originals must not replace a review already authored in the app.
      const native = (await variant.query(`INSERT INTO personas (identificacion,nombre,apellido1)
        VALUES ('707070707','Persona','Nativa') RETURNING id`)).rows[0];
      const author = (await variant.query("SELECT id FROM usuarios WHERE email='unique@example.test'")).rows[0];
      const nativeReview = (await variant.query(`INSERT INTO resenas
        (persona_id,autor_id,comentario,estado,anonima,verificada,detalle_verificacion)
        VALUES ($1,$2,'contenido escrito en la app','oculta',true,true,'verificación original') RETURNING *`,
      [native.id, author.id])).rows[0];
      await variant.query('INSERT INTO resena_etiquetas (resena_id,etiqueta_id) VALUES ($1,1)', [nativeReview.id]);
      const nativeTags = await relationships(nativeReview.id);
      await source.query(`INSERT INTO tb_inquilinos_no_nacionales
        (camp_id_inquilino,camp_identificacion,camp_nombre,camp_apellido_uno,camp_fk_registrador,
         camp_comentario_adicional,camp_fecha_registro,camp_estado,camp_fk_etiqueta_uno,camp_fk_conducta)
        VALUES (24,'707070707','Persona','Nativa',2,'original antiguo','2020-01-01 12:00:00',1,90,91),
        (25,'707070707','Persona','Nativa',500,'original más reciente','2025-01-01 12:00:00',1,90,91)`);
      const preserved = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(preserved.code, 0, preserved.stderr);
      assert.equal(preserved.resumen.resenas, 6);
      assert.deepEqual(preserved.resumen.fichas, { leidas: 11, archivadas: 11, consolidadas: 4, conservadas: 1 });
      assert.deepEqual((await variant.query('SELECT * FROM resenas WHERE id=$1', [nativeReview.id])).rows[0], nativeReview);
      assert.deepEqual(await relationships(nativeReview.id), nativeTags);
      assert.equal((await variant.query("SELECT count(*)::int AS n FROM resenas WHERE fuente='legacy' OR id=$1", [nativeReview.id])).rows[0].n, 7);
      assert.deepEqual((await archived()).filter((r) => [24,25].includes(r.id_fuente)).map((r) => r.resena_id),
        [nativeReview.id, nativeReview.id]);

      const pending = (await variant.query("SELECT * FROM resenas WHERE fuente='legacy' AND id_fuente=11")).rows[0];
      assert.equal(pending.primera_aprobacion_en, null);
      await source.query(`INSERT INTO tb_inquilinos_no_nacionales
        (camp_id_inquilino,camp_identificacion,camp_nombre,camp_apellido_uno,camp_fk_registrador,
         camp_comentario_adicional,camp_fecha_registro,camp_estado)
        VALUES (26,'404040404','Persona','Histórica',1,'aprobada hace años','2019-01-01 12:00:00',1)`);
      const approved = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(approved.code, 0, approved.stderr);
      const historical = (await variant.query('SELECT * FROM resenas WHERE id=$1', [pending.id])).rows[0];
      assert.equal(historical.id_fuente, 26);
      assert.equal(historical.estado, 'publicada');
      assert.equal(historical.primera_aprobacion_en.toISOString(), historical.creado_en.toISOString());
      assert.equal(historical.primera_aprobacion_en.getUTCFullYear(), 2019, 'import does not approve old content as of today');
      const receipt = (await variant.query('SELECT aprobada_en FROM privado.aportes_consulta WHERE resena_id=$1', [pending.id])).rows;
      assert.deepEqual(receipt, [{ aprobada_en: historical.primera_aprobacion_en }]);
      const access = (await variant.query('SELECT puede_consultar FROM public.accesos_consulta($1::int[])', [[pending.autor_id]])).rows[0];
      assert.equal(access.puede_consultar, false, 'historical approval cannot grant fresh consultation access');

      // Force a failure while archiving a nonwinning row, after canonical writes.
      await variant.query(`ALTER TABLE privado.resenas_legacy_originales ADD CONSTRAINT reject_test_archive
        CHECK (datos->>'camp_comentario_adicional' <> 'FAIL-ARCHIVE')`);
      await source.query(`UPDATE tb_inquilinos_no_nacionales
        SET camp_comentario_adicional='FAIL-ARCHIVE',camp_fecha_registro='2022-01-01 12:00:00' WHERE camp_id_inquilino=21`);
      await source.query(`UPDATE tb_inquilinos_no_nacionales
        SET camp_comentario_adicional='must also roll back',camp_fecha_registro='2024-01-01 12:00:00' WHERE camp_id_inquilino=23`);
      const beforeFailure = await completeSnapshot();
      for (const args of [[], ['--seco']]) {
        const failed = await run(args, { DATABASE_URL: databaseUrl });
        assert.equal(failed.code, 1);
        assert.match(failed.stderr, /No se guardaron/);
        assert.equal(failed.resumen, null);
        assert.deepEqual(await completeSnapshot(), beforeFailure, 'archive and canonical changes roll back together');
      }
    } finally {
      await source.query('DELETE FROM tb_inquilinos_no_nacionales WHERE camp_id_inquilino BETWEEN 20 AND 26');
      await source.query('DELETE FROM tb_conducta WHERE camp_id_conducta=91');
      await source.query('SET time_zone = ?', [sourceSettings[0].timeZone]);
      await variant.end();
      await target.query('DROP DATABASE import_duplicate_reviews');
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

  await t.test('access-only provisioning reconciles imported profiles without overwriting current data or passwords', async () => {
    await target.query('CREATE DATABASE import_access_only');
    const databaseUrl = `postgres://postgres@127.0.0.1:${pgPort}/import_access_only`;
    const variant = new pg.Client({ connectionString: databaseUrl });
    await variant.connect();
    const extra = [
      ['linked', '810000001', 'legacy-linked'],
      ['collision', '810000002', 'legacy-collision'],
      ['conflict', '810000003', 'legacy-conflict'],
      ['weak', '810000004', 'legacy-weak'],
      ['detached', '810000005', 'legacy-detached'],
      ['failed', '810000006', 'legacy-failed'],
    ];
    const requests = [];
    let rejectFailure = true;
    const server = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      requests.push(body);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Supabase-Api-Version', '2024-01-01');
      if (body.email === 'weak@example.test' && body.password === 'legacy-weak') {
        res.statusCode = 422;
        res.end(JSON.stringify({ code: 'weak_password', msg: 'Password should contain a number and a symbol.' }));
        return;
      }
      if (body.email === 'failed@example.test' && rejectFailure) {
        res.statusCode = 422;
        res.end(JSON.stringify({ code: 'email_address_invalid', msg: 'Fixture rejection unrelated to password.' }));
        return;
      }
      const id = `10000000-0000-4000-8000-${String(requests.length).padStart(12, '0')}`;
      await variant.query('INSERT INTO auth.users (id,email,encrypted_password) VALUES ($1,$2,$3)', [id, body.email, body.password_hash ?? body.password]);
      res.end(JSON.stringify({ id, email: body.email, aud: 'authenticated', role: 'authenticated' }));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const authEnv = { DATABASE_URL: databaseUrl, SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SECRET_KEY: 'test-only-key' };
    const args = ['--solo-accesos', '--crear-accounts', '--limite-auth=100', '--tiempo-auth=150'];
    let sourceTablesRenamed = false;
    try {
      await variant.query(await readFile('schema.sql', 'utf8'));
      await variant.query(await readFile('db/seeds.sql', 'utf8'));
      await variant.query('CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT NULL::text$$; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text UNIQUE, encrypted_password text)');
      for (let i = 0; i < extra.length; i++) {
        const [name, document, password] = extra[i];
        await source.query(`INSERT INTO users
          (user_id,firstname,lastname,document,telephone,age,status,date_added,img_user,observaciones,access,id_resenador,resenador,nombre_completo,user_email,user_password_hash)
          VALUES (?,?,'Importado',?,'',50,'activo','2020-01-01','','','propietario','','','',?,?)`,
        [20000 + i, name, document, `${name}@example.test`, password]);
      }
      const imported = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(imported.code, 0, imported.stderr);
      await variant.query(`UPDATE usuarios SET activo=false,rol='inquilino',nombre='Inactivo actual' WHERE email='one@example.test';
        UPDATE usuarios SET rol='admin',nombre='Administrador actual',telefono='8888-8888' WHERE email='two@example.test';
        UPDATE usuarios SET identificacion='819999999' WHERE email='conflict@example.test'`);
      const currentAuth = '20000000-0000-4000-8000-000000000001';
      const existingAuth = '20000000-0000-4000-8000-000000000002';
      const occupiedAuth = '20000000-0000-4000-8000-000000000003';
      await variant.query(`INSERT INTO auth.users VALUES
        ($1,'unique@example.test','current-password-hash'),
        ($2,'linked@example.test','existing-password-hash'),
        ($3,'collision@example.test','occupied-password-hash')`, [currentAuth, existingAuth, occupiedAuth]);
      await variant.query("UPDATE usuarios SET auth_user_id=$1 WHERE email='unique@example.test'", [currentAuth]);
      await variant.query("INSERT INTO usuarios (email,nombre,auth_user_id) VALUES ('auth-owner@example.test','Current owner',$1)", [occupiedAuth]);
      // This profile was part of the completed import, but is absent from the
      // source now. It must be reported, never silently treated as provisioned.
      await source.query("DELETE FROM users WHERE user_email='detached@example.test'");
      // A source account added after that import must not create a new profile.
      await source.query(`INSERT INTO users
        (user_id,firstname,lastname,document,telephone,age,status,date_added,img_user,observaciones,access,id_resenador,resenador,nombre_completo,user_email,user_password_hash)
        VALUES (20010,'New','Source','810000010','',50,'activo','2020-01-01','','','propietario','','','','source-only@example.test','source-password')`);
      const before = await snapshot(variant);
      const oldAuth = (await variant.query('SELECT * FROM auth.users ORDER BY id')).rows;
      // No catalog or review table is needed to finish access for imported users.
      await source.query('RENAME TABLE tb_inquilinos_no_nacionales TO access_fichas_fuera, tb_paises TO access_paises_fuera');
      sourceTablesRenamed = true;
      const sequences = async () => (await variant.query(`SELECT schemaname, sequencename, last_value
        FROM pg_sequences ORDER BY schemaname, sequencename`)).rows;
      const beforeSequences = await sequences();
      // An ordinary SELECT-only login must be enough for the access preview.
      // Its database-level read-only default also catches unintended writes.
      await variant.query(`CREATE ROLE access_preview_reader LOGIN;
        GRANT USAGE ON SCHEMA public, auth TO access_preview_reader;
        GRANT SELECT ON ALL TABLES IN SCHEMA public, auth TO access_preview_reader;
        ALTER ROLE access_preview_reader SET default_transaction_read_only = on`);
      const previewEnv = { DATABASE_URL: `postgres://access_preview_reader@127.0.0.1:${pgPort}/import_access_only` };
      const preview = await run(['--solo-accesos', '--seco'], previewEnv);
      assert.equal(preview.code, 0, preview.stderr);
      assert.equal(preview.resumen.estado, 'simulacion');
      assert.equal(preview.resumen.accesos.elegibles, 4);
      assert.equal(preview.resumen.accesos.pendientes, 4);
      assert.equal(preview.resumen.accesos.conflictos, 2, 'occupied Auth identities are excluded before provisioning');
      assert.equal(preview.resumen.accesos.creadas, 0);
      assert.equal(preview.resumen.accesos.enlazadas, 0);
      assert.deepEqual(preview.resumen.previsionAccesos, {
        crear: 3, enlazar: 1,
        claves: { hashCompatible: 0, texto: 3, restablecer: 0 },
        roles: { admin: 1, propietario: 3, agencia: 0, inquilino: 0 },
        sinDocumentoComparable: 0,
      });
      assert.match(preview.resumen.advertencias.find((a) => a.codigo === 'prevision_accesos').mensaje, /previsión.*puede rechazar/);
      // --seco must override the redundant creation flag even with valid Auth config.
      const previewWithAuthFlag = await run(['--solo-accesos', '--crear-accounts', '--seco'], { ...authEnv, ...previewEnv });
      assert.equal(previewWithAuthFlag.code, 0, previewWithAuthFlag.stderr);
      assert.deepEqual(previewWithAuthFlag.resumen, preview.resumen);
      assert.equal(requests.length, 0, 'previews never call the Auth API');
      assert.deepEqual(await snapshot(variant), before, 'previews do not change any profile or imported data');
      assert.deepEqual(await sequences(), beforeSequences, 'previews do not advance sequences');
      assert.deepEqual((await variant.query('SELECT * FROM auth.users ORDER BY id')).rows, oldAuth, 'previews do not create or change Auth rows');
      const first = await run(args, authEnv);
      assert.equal(first.code, 2, first.stderr);
      const coverage = first.resumen.accesos;
      assert.equal(coverage.total, before.usuarios.length);
      for (const campo of ['total', 'existentes', 'inactivas', 'sinCorreo', 'sinOrigen', 'conflictos', 'elegibles']) {
        assert.equal(coverage[campo], preview.resumen.accesos[campo], `preview and apply use the same ${campo} classification`);
      }
      assert.equal(coverage.total, coverage.existentes + coverage.inactivas + coverage.sinCorreo + coverage.sinOrigen + coverage.conflictos + coverage.elegibles);
      assert.equal(coverage.sinOrigen, 4, 'the detached imported profile and three unrelated seed profiles are reported');
      assert.equal(coverage.conflictos, 2);
      assert.equal(coverage.enlazadas, 1);
      assert.equal(coverage.creadas, 2);
      assert.equal(coverage.fallidas, 1);
      assert.equal(coverage.pendientes, 1);
      assert.equal(coverage.conservadas, 1);
      assert.equal(coverage.restablecer, 1);
      assert.equal(first.resumen.personas, 0);
      assert.equal(first.resumen.usuarios, 0);
      assert.equal(first.resumen.resenas, 0);
      const after = await snapshot(variant);
      const withoutAccess = (s) => ({
        ...s,
        usuarios: s.usuarios.map((u) => Object.fromEntries(Object.entries(u).filter(([key]) => !['auth_user_id', 'actualizado_en'].includes(key)))),
      });
      assert.deepEqual(withoutAccess(after), withoutAccess(before), 'only auth links and their update timestamp may change');
      assert.deepEqual((await variant.query('SELECT * FROM auth.users WHERE id=ANY($1::uuid[]) ORDER BY id', [[currentAuth, existingAuth, occupiedAuth]])).rows, oldAuth, 'existing Auth credentials stay intact');
      assert.equal(after.usuarios.find((u) => u.email === 'linked@example.test').auth_user_id, existingAuth);
      assert.equal(after.usuarios.find((u) => u.email === 'collision@example.test').auth_user_id, null);
      assert.equal(after.usuarios.find((u) => u.email === 'one@example.test').auth_user_id, null);
      assert.equal(after.usuarios.some((u) => u.email === 'source-only@example.test'), false);
      assert.deepEqual(requests.map((r) => r.email).sort(), ['failed@example.test', 'two@example.test', 'weak@example.test', 'weak@example.test']);
      const weakRequests = requests.filter((r) => r.email === 'weak@example.test');
      assert.equal(weakRequests[0].password, 'legacy-weak');
      assert.notEqual(weakRequests[1].password, 'legacy-weak');
      assert.ok(weakRequests[1].password.length >= 32);
      assert.equal(weakRequests[1].password_hash, undefined);

      rejectFailure = false;
      const requestCount = requests.length;
      const retry = await run(args, authEnv);
      assert.equal(retry.resumen.accesos.creadas, 1);
      assert.equal(retry.resumen.accesos.pendientes, 0);
      assert.equal(retry.resumen.accesos.fallidas, 0);
      assert.deepEqual(requests.slice(requestCount).map((r) => r.email), ['failed@example.test'], 'retries skip every successfully linked account');
      assert.deepEqual(withoutAccess(await snapshot(variant)), withoutAccess(before));
    } finally {
      if (sourceTablesRenamed) await source.query('RENAME TABLE access_fichas_fuera TO tb_inquilinos_no_nacionales, access_paises_fuera TO tb_paises');
      await source.query('DELETE FROM users WHERE user_id BETWEEN 20000 AND 20010');
      await new Promise((resolve) => server.close(resolve));
      await variant.end();
      await target.query('DROP DATABASE import_access_only');
      await target.query('DROP ROLE IF EXISTS access_preview_reader');
    }
  });

  await t.test('access-only batches advance through more than 100 already imported users and refuse a missing account source', async () => {
    await target.query('CREATE DATABASE import_access_batches');
    const databaseUrl = `postgres://postgres@127.0.0.1:${pgPort}/import_access_batches`;
    const variant = new pg.Client({ connectionString: databaseUrl });
    await variant.connect();
    const requests = [];
    const rejectedEmails = new Set();
    const server = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      requests.push(body.email);
      res.setHeader('Content-Type', 'application/json');
      if (rejectedEmails.has(body.email)) {
        res.statusCode = 422;
        res.end(JSON.stringify({ error_code: 'email_address_invalid', msg: 'Persistent fixture rejection.' }));
        return;
      }
      const id = `30000000-0000-4000-8000-${String(requests.length).padStart(12, '0')}`;
      await variant.query('INSERT INTO auth.users VALUES ($1,$2)', [id, body.email]);
      res.end(JSON.stringify({ id, email: body.email, aud: 'authenticated', role: 'authenticated' }));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const authEnv = { DATABASE_URL: databaseUrl, SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SECRET_KEY: 'test-only-key' };
    const args = ['--solo-accesos', '--crear-accounts', '--limite-auth=100', '--tiempo-auth=150'];
    let sourceAccountsRenamed = false;
    try {
      await variant.query(await readFile('schema.sql', 'utf8'));
      await variant.query(await readFile('db/seeds.sql', 'utf8'));
      await variant.query('CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT NULL::text$$; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text UNIQUE)');
      const rows = Array.from({ length: 105 }, (_, i) => [30000 + i, `Batch ${i}`, String(820000000 + i), `batch-${i}@example.test`]);
      for (const [id, name, document, email] of rows) {
        await source.query(`INSERT INTO users
          (user_id,firstname,lastname,document,telephone,age,status,date_added,img_user,observaciones,access,id_resenador,resenador,nombre_completo,user_email,user_password_hash)
          VALUES (?,?,'Importado',?,'',50,'activo','2020-01-01','','','propietario','','','',?,'batch-password')`, [id, name, document, email]);
      }
      const imported = await run([], { DATABASE_URL: databaseUrl });
      assert.equal(imported.code, 0, imported.stderr);
      await variant.query("UPDATE usuarios SET activo=false WHERE email IN ('admin@laprotec.test','propietario@laprotec.test','inquilino@laprotec.test')");
      const beforeProvisioning = await snapshot(variant);
      const mismatchedProject = await run(args, {
        ...authEnv,
        SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
        DATABASE_URL: 'postgresql://postgres.bbbbbbbbbbbbbbbbbbbb:test@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
      });
      assert.notEqual(mismatchedProject.code, 0);
      assert.match(mismatchedProject.stderr, /proyectos distintos/);
      assert.equal(requests.length, 0);
      assert.deepEqual(await snapshot(variant), beforeProvisioning);
      await variant.query('SELECT pg_advisory_lock(736284,1)');
      try {
        const locked = await run(args, authEnv);
        assert.notEqual(locked.code, 0);
        assert.match(locked.stderr, /importación en curso/);
        assert.equal(requests.length, 0);
      } finally { await variant.query('SELECT pg_advisory_unlock(736284,1)'); }
      const shortDeadline = await run(['--solo-accesos', '--crear-accounts', '--limite-auth=100', '--tiempo-auth=1'], authEnv);
      assert.equal(shortDeadline.code, 2, shortDeadline.stderr);
      assert.equal(shortDeadline.resumen.accesos.pendientes, 108);
      assert.equal(shortDeadline.resumen.accesos.creadas, 0);
      assert.equal(shortDeadline.resumen.accesos.fallidas, 0);
      assert.equal(requests.length, 0, 'insufficient deadline returns remaining work before calling Auth');
      assert.deepEqual(await snapshot(variant), beforeProvisioning);
      const first = await run(args, authEnv);
      assert.equal(first.code, 2, first.stderr);
      assert.equal(first.resumen.accesos.elegibles, 108);
      assert.equal(first.resumen.accesos.creadas, 100);
      assert.equal(first.resumen.accesos.pendientes, 8);
      assert.equal(first.resumen.accesos.fallidas, 0);
      assert.ok(first.resumen.accesos.siguienteId > 0);
      assert.equal(requests.length, 100);
      const second = await run([...args, `--despues-auth=${first.resumen.accesos.siguienteId}`], authEnv);
      assert.equal(second.code, 0, second.stderr);
      assert.equal(second.resumen.accesos.existentes, 100);
      assert.equal(second.resumen.accesos.creadas, 8);
      assert.equal(second.resumen.accesos.pendientes, 0);
      assert.equal(second.resumen.accesos.siguienteId, 0);
      assert.equal(requests.length, 108);
      assert.equal(new Set(requests).size, 108, 'already completed identities are never created again');
      const completed = await snapshot(variant);
      const third = await run(args, authEnv);
      assert.equal(third.code, 0, third.stderr);
      assert.equal(third.resumen.accesos.creadas, 0);
      assert.equal(third.resumen.accesos.elegibles, 0);
      assert.equal(requests.length, 108);
      assert.deepEqual(await snapshot(variant), completed);

      // Re-open only three disposable fixture accounts. Two permanent failures
      // must not consume every future batch and starve the valid account after them.
      const lastEmails = ['batch-102@example.test', 'batch-103@example.test', 'batch-104@example.test'];
      await variant.query('UPDATE usuarios SET auth_user_id=NULL WHERE email=ANY($1::text[])', [lastEmails]);
      await variant.query('DELETE FROM auth.users WHERE email=ANY($1::text[])', [lastEmails]);
      for (const email of lastEmails.slice(0, 2)) rejectedEmails.add(email);
      const failureBatchArgs = ['--solo-accesos', '--crear-accounts', '--limite-auth=2', '--tiempo-auth=150'];
      const blocked = await run(failureBatchArgs, authEnv);
      assert.equal(blocked.code, 2, blocked.stderr);
      assert.equal(blocked.resumen.accesos.fallidas, 2);
      assert.equal(blocked.resumen.accesos.pendientes, 3);
      assert.ok(blocked.resumen.accesos.siguienteId > 0);
      const continued = await run([...failureBatchArgs, `--despues-auth=${blocked.resumen.accesos.siguienteId}`], authEnv);
      assert.equal(continued.code, 2, continued.stderr);
      assert.equal(continued.resumen.accesos.creadas, 1);
      assert.equal(continued.resumen.accesos.pendientes, 2);
      assert.equal(continued.resumen.accesos.siguienteId, 0, 'the end of the scan restarts later retries at the beginning');
      assert.deepEqual(requests.slice(108), lastEmails, 'continuing after failures reaches the valid later account');
      rejectedEmails.clear();
      const recovered = await run(args, authEnv);
      assert.equal(recovered.code, 0, recovered.stderr);
      assert.equal(recovered.resumen.accesos.creadas, 2);
      assert.equal(recovered.resumen.accesos.pendientes, 0);
      assert.equal(requests.length, 113);
      const recoveredSnapshot = await snapshot(variant);

      await source.query('RENAME TABLE users TO access_users_fuera, tb_login TO access_login_fuera');
      sourceAccountsRenamed = true;
      const missingSource = await run(args, authEnv);
      assert.notEqual(missingSource.code, 0);
      assert.equal(requests.length, 113);
      assert.deepEqual(await snapshot(variant), recoveredSnapshot);
      assert.match(missingSource.stderr, /users|tb_login|origen/i);
    } finally {
      if (sourceAccountsRenamed) await source.query('RENAME TABLE access_users_fuera TO users, access_login_fuera TO tb_login');
      await source.query('DELETE FROM users WHERE user_id BETWEEN 30000 AND 30104');
      await new Promise((resolve) => server.close(resolve));
      await variant.end();
      await target.query('DROP DATABASE import_access_batches');
    }
  });
});
