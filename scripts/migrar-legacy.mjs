// ============================================================================
// Migración: MySQL legacy (`laprotec_laprotectora`) → PostgreSQL (Supabase)
// ----------------------------------------------------------------------------
// Uso:
//   node scripts/migrar-legacy.mjs                  # ejecuta todos los pasos
//   node scripts/migrar-legacy.mjs --seco           # solo cuenta, no escribe
//   node scripts/migrar-legacy.mjs --pasos=lookups,personas,usuarios,resenas
//   node scripts/migrar-legacy.mjs --crear-accounts # crea identidades en Supabase Auth
//
// Variables de entorno:
//   LEGACY_MYSQL_HOST / PORT / USER / PASSWORD / DB  (fuente MySQL)
//   DATABASE_URL                                      (Postgres destino, conexión directa)
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY          (solo con --crear-accounts)
//
// Idempotente: puede correrse varias veces (upsert por clave natural).
// Los ids de lookups legacy se preservan para que las FK de fichas sigan válidas;
// las FK que no encuentran su lookup en destino se convierten en NULL.
// ============================================================================

import mysql from 'mysql2/promise';
import pg from 'pg';

const args = process.argv.slice(2);
const seco = args.includes('--seco');
const pasoArg = args.find((a) => a.startsWith('--pasos='));
const PASOS = pasoArg ? pasoArg.split('=').pop().split(',') : ['lookups', 'personas', 'usuarios', 'resenas'];
const CREAR_ACCOUNTS = args.includes('--crear-accounts') && !seco;

// Carga .env.local (convención Next.js) y, si existe, .env; no sobreescribe lo ya definido
for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(new URL(`../${f}`, import.meta.url)); } catch { /* opcional */ }
}

const mysqlCfg = {
  host: process.env.LEGACY_MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.LEGACY_MYSQL_PORT ?? 3306),
  user: process.env.LEGACY_MYSQL_USER ?? 'root',
  password: process.env.LEGACY_MYSQL_PASSWORD ?? '',
  database: process.env.LEGACY_MYSQL_DB ?? 'laprotec_laprotectora',
  connectionLimit: 2,
  // El legacy mezcla latin1/utf8/utf8mb4: forzar utf8mb4 para decodificar bien
  charset: 'utf8mb4',
};

if (!seco && !process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL (conexión directa a Postgres) o usa --seco');
  process.exit(1);
}
if (CREAR_ACCOUNTS && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('--crear-accounts requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Supabase/pooler usa certificado autofirmado: ciframos sin validar la cadena.
// (El dashboard permite descargar la CA oficial para validación estricta.)
function sslConfig() {
  if (process.env.DATABASE_SSL === 'false') return undefined;
  if ((process.env.DATABASE_URL ?? '').includes('supabase.co')) return { rejectUnauthorized: false };
  return undefined;
}

const m = await mysql.createPool(mysqlCfg);
const pool = !seco ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig() }) : null;
const supabaseAdmin = CREAR_ACCOUNTS
  ? (await import('@supabase/supabase-js')).createClient(
      process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    )
  : null;

const log = (msg) => console.log(`\n▸ ${msg}`);
const resumen = { lookups: {}, personas: 0, usuarios: 0, resenas: 0 };

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function mysqlRows(sql, params = []) {
  const [rows] = await m.query(sql, params);
  return rows;
}

async function mysqlTableExists(name) {
  const rows = await mysqlRows(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [name],
  );
  return rows.length > 0;
}

async function mysqlFindTable(patterns) {
  const rows = await mysqlRows(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (?)`,
    [patterns],
  );
  return rows[0]?.table_name ?? null;
}

async function mysqlAll(table) {
  if (!(await mysqlTableExists(table))) return null;
  return mysqlRows(`SELECT * FROM \`${table}\``);
}

/**
 * Upsert de una fila. `sql` debe ser el INSERT/ON CONFLICT completo,
 * con sus placeholders ($1..$n) ya en el VALUES.
 */
async function upsert(sql, row, label) {
  if (seco) return 0;
  try {
    await pool.query(sql, row);
    return 1;
  } catch (e) {
    console.error(`  ✗ ${label}: ${e.message}`);
    return 0;
  }
}

/** Solo devuelve el id si existe en el lookup de destino (si no, NULL). */
const ref = (set, v) => (v == null ? null : (set.has(Number(v)) ? Number(v) : null));

// Ids presentes en destino para cada lookup (se llena en pasoLookups)
const IDS = {
  paises: new Set(), provincias: new Set(), cantones: new Set(), distritos: new Set(),
  barrios: new Set(), calificaciones: new Set(), califPorValor: new Map(),
  etiquetas: new Set(), tipos_contrato: new Set(), tipos_alquiler: new Set(),
  tiempos_alquiler: new Set(), danos: new Set(), procesos: new Set(), conductas: new Set(),
};

async function cargarIdsDestino() {
  if (seco) return;
  const mapa = {
    paises: 'paises', provincias: 'provincias', cantones: 'cantones',
    distritos: 'distritos', barrios: 'barrios', etiquetas: 'etiquetas',
    tipos_contrato: 'tipos_contrato', tipos_alquiler: 'tipos_alquiler',
    tiempos_alquiler: 'tiempos_alquiler', danos_vivienda: 'danos',
    procesos_judiciales: 'procesos', conductas: 'conductas',
  };
  for (const [tabla, clave] of Object.entries(mapa)) {
    const q = await pool.query(`SELECT id FROM ${tabla}`);
    IDS[clave] = new Set(q.rows.map((r) => r.id));
  }
  const cal = await pool.query(`SELECT id, valor FROM calificaciones`);
  IDS.calificaciones = new Set(cal.rows.map((r) => r.id));
  IDS.califPorValor = new Map(cal.rows.map((r) => [r.valor, r.id]));
}

// ----------------------------------------------------------------------------
// PASO 1 — Lookups (ids legacy preservados)
// ----------------------------------------------------------------------------

async function copiarLookup(tabla, destinoSql, cols, secuencia) {
  const nombre = await mysqlFindTable(tabla);
  if (!nombre) { console.log(`  · ${tabla.join('/')} no existe en legacy (usa seed local)`); return; }
  const rows = await mysqlRows(
    `SELECT ${cols.map((c) => `\`${c[0]}\``).join(', ')} FROM \`${nombre}\``,
  );
  let ok = 0;
  for (const r of rows) {
    ok += await upsert(destinoSql, cols.map((c) => r[c[0]]), `${nombre}#${r[cols[0][0]]}`);
  }
  if (!seco && secuencia) {
    await pool.query(`SELECT setval(pg_get_serial_sequence('${secuencia}','id'), COALESCE((SELECT max(id) FROM ${secuencia}), 1))`);
  }
  console.log(`  ${nombre} → ${ok}/${rows.length} filas`);
  resumen.lookups[nombre] = rows.length;
}

async function pasoLookups() {
  log('Lookups (geografía CR + dominios)');

  await copiarLookup(['tb_paises'],
    `INSERT INTO paises (id, iso2, nombre) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre`,
    [['id', 'id'], ['iso2', 'iso'], ['nombre', 'nombre']], 'paises');

  await copiarLookup(['tb_provincia'],
    `INSERT INTO provincias (id, codigo, nombre) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre`,
    [['id', 'camp_id_provincia'], ['codigo', 'camp_provincia'], ['nombre', 'camp_nombre_provincia']], 'provincias');

  await copiarLookup(['tb_canton'],
    `INSERT INTO cantones (id, provincia_id, codigo, nombre) VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO NOTHING`,
    [['id', 'camp_id'], ['provincia_id', 'camp_idProvincia'], ['codigo', 'camp_codigo'], ['nombre', 'camp_canton']], 'cantones');

  await copiarLookup(['tb_distrito'],
    `INSERT INTO distritos (id, canton_id, codigo, nombre) VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO NOTHING`,
    [['id', 'camp_id'], ['canton_id', 'camp_idCanton'], ['codigo', 'camp_codigo'], ['nombre', 'camp_distrito']], 'distritos');

  await copiarLookup(['tb_barrio'],
    `INSERT INTO barrios (id, distrito_id, codigo, nombre) VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO NOTHING`,
    [['id', 'camp_id'], ['distrito_id', 'camp_idDistrito'], ['codigo', 'camp_codigo'], ['nombre', 'camp_barrio']], 'barrios');

  await copiarLookup(['tb_calificacion', 'tb_calificaciones'],
    `INSERT INTO calificaciones (id, valor, texto) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO NOTHING`,
    [['id', 'camp_id_calificacion'], ['valor', 'camp_valor'], ['texto', 'camp_texto']], 'calificaciones');

  await copiarLookup(['tb_etiquetainquilino'],
    `INSERT INTO etiquetas (id, nombre, tipo) VALUES ($1,$2,'inquilino')
     ON CONFLICT (id) DO NOTHING`,
    [['id', 'camp_id_etiquetaInquilino'], ['nombre', 'camp_etiquetaInquilino_nombre']], 'etiquetas');

  await copiarLookup(['tb_conducta'],
    `INSERT INTO conductas (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
    [['id', 'camp_id_conducta'], ['nombre', 'camp_conducta']], 'conductas');

  await copiarLookup(['tb_tipoalquiler'],
    `INSERT INTO tipos_alquiler (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
    [['id', 'camp_id_tipoAlquiler'], ['nombre', 'camp_tipoAlquiler_nombre']], 'tipos_alquiler');

  await copiarLookup(['tb_tipo_contrato', 'tb_tipos_contrato'],
    `INSERT INTO tipos_contrato (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
    [['id', 'camp_id_tipo_contrato'], ['nombre', 'camp_nombre']], 'tipos_contrato');

  await copiarLookup(['tb_tiempo_alquiler', 'tb_tiempoalquiler'],
    `INSERT INTO tiempos_alquiler (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
    [['id', 'camp_id'], ['nombre', 'camp_nombre']], 'tiempos_alquiler');

  await copiarLookup(['tb_dano_vivienda', 'tb_danovivienda'],
    `INSERT INTO danos_vivienda (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
    [['id', 'camp_id'], ['nombre', 'camp_nombre']], 'danos_vivienda');

  await copiarLookup(['tb_proceso_judicial', 'tb_procesojudicial'],
    `INSERT INTO procesos_judiciales (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
    [['id', 'camp_id'], ['nombre', 'camp_nombre']], 'procesos_judiciales');

  // tb_sexo no existe en v2 (columna CHECK): solo se usa para normalizar
  const sexoTabla = await mysqlFindTable(['tb_sexo']);
  if (sexoTabla) {
    const rows = await mysqlRows(`SELECT camp_id_sexo, cam_sexo FROM \`${sexoTabla}\``);
    console.log(`  ${sexoTabla} → ${rows.length} valores (se normalizan al importar personas)`);
    resumen.lookups[sexoTabla] = rows.length;
  }

  await cargarIdsDestino();
}

// ----------------------------------------------------------------------------
// PASO 2 — Personas
// ----------------------------------------------------------------------------

function normalizaSexo(legacyId, mapa) {
  const v = mapa.get(Number(legacyId));
  if (!v) return null;
  if (/masc|varon|hombr/.test(v)) return 'masculino';
  if (/fem|mujer/.test(v)) return 'femenino';
  return 'otro';
}

async function mapaSexo() {
  const tabla = await mysqlFindTable(['tb_sexo']);
  if (!tabla) return new Map();
  const rows = await mysqlRows(`SELECT camp_id_sexo, cam_sexo FROM \`${tabla}\``);
  return new Map(rows.map((r) => [Number(r.camp_id_sexo), r.cam_sexo?.toLowerCase() ?? '']));
}

async function mapaDomicilios() {
  const map = new Map();
  const ubi = await mysqlRows(`SELECT * FROM tb_ubicacion WHERE camp_codi IS NOT NULL`).catch(() => []);
  if (!ubi.length) return map;
  const nombres = new Map();
  for (const t of ['provincias', 'cantones', 'distritos']) {
    const rows = seco ? [] : (await pool.query(`SELECT id, nombre FROM ${t}`)).rows;
    nombres.set(t, rows.map((r) => [r.id, r.nombre.toLowerCase()]));
  }
  const buscar = (tabla, n) => {
    if (n == null || !String(n).trim()) return null;
    const [id] = nombres.get(tabla)?.find(([, v]) => v === String(n).trim().toLowerCase()) ?? [];
    return id ?? null;
  };
  for (const u of ubi) {
    map.set(u.camp_codi, {
      provincia_id: buscar('provincias', u.camp_Provincia),
      canton_id: buscar('cantones', u.camp_Canton),
      distrito_id: buscar('distritos', u.camp_Distrito),
    });
  }
  return map;
}

const SQL_UPSERT_PERSONA = `
  INSERT INTO personas
    (identificacion, nombre, nombre2, apellido1, apellido2, pais_id,
     fecha_nacimiento, sexo, provincia_id, canton_id, distrito_id, barrio_id, foto_url)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
  ON CONFLICT (identificacion) DO UPDATE SET
    nombre = COALESCE(EXCLUDED.nombre, personas.nombre),
    nombre2 = COALESCE(EXCLUDED.nombre2, personas.nombre2),
    apellido1 = COALESCE(EXCLUDED.apellido1, personas.apellido1),
    apellido2 = COALESCE(EXCLUDED.apellido2, personas.apellido2),
    pais_id = COALESCE(EXCLUDED.pais_id, personas.pais_id),
    fecha_nacimiento = COALESCE(EXCLUDED.fecha_nacimiento, personas.fecha_nacimiento),
    sexo = COALESCE(EXCLUDED.sexo, personas.sexo),
    provincia_id = COALESCE(EXCLUDED.provincia_id, personas.provincia_id),
    canton_id = COALESCE(EXCLUDED.canton_id, personas.canton_id),
    distrito_id = COALESCE(EXCLUDED.distrito_id, personas.distrito_id),
    barrio_id = COALESCE(EXCLUDED.barrio_id, personas.barrio_id),
    foto_url = COALESCE(EXCLUDED.foto_url, personas.foto_url)`;

async function upsertPersona(p, sexoMap) {
  return upsert(SQL_UPSERT_PERSONA, [
    p.identificacion,
    p.nombre ?? null, p.nombre2 ?? null, p.apellido1 ?? null, p.apellido2 ?? null,
    ref(IDS.paises, p.pais_id),
    p.fecha_nacimiento ?? null,
    normalizaSexo(p.sexoId, sexoMap),
    ref(IDS.provincias, p.provincia_id), ref(IDS.cantones, p.canton_id),
    ref(IDS.distritos, p.distrito_id), ref(IDS.barrios, p.barrio_id),
    p.foto_url ?? null,
  ], `persona ${p.identificacion}`);
}

async function pasoPersonas() {
  log('Personas');
  const sexoMap = await mapaSexo();
  const domicilioMap = await mapaDomicilios();

  const tbPersona = await mysqlAll('tb_persona');
  if (tbPersona) {
    let n = 0;
    for (const r of tbPersona) {
      const dom = domicilioMap.get(r.camp_fk_domicilio) ?? {};
      n += await upsertPersona({
        identificacion: r.camp_identificacion,
        nombre: r.camp_nombreUno, nombre2: r.camp_nombreDOs,
        apellido1: r.camp_apellidoUno, apellido2: r.camp_apellidoDos,
        pais_id: r.camp_fk_nacionalidad, fecha_nacimiento: r.camp_fechaNacimiento,
        sexoId: r.camp_fk_sexo, ...dom,
      }, sexoMap);
    }
    resumen.personas += n;
    console.log(`  tb_persona → ${n}`);
  } else console.log('  · tb_persona no existe');

  const fichas = await mysqlAll('tb_inquilinos_no_nacionales');
  if (fichas) {
    let n = 0;
    for (const r of fichas) {
      n += await upsertPersona({
        identificacion: r.camp_identificacion || `LEGACY-${r.camp_id_inquilino}`,
        nombre: r.camp_nombre, apellido1: r.camp_apellido_uno, apellido2: r.camp_apellido_dos,
        pais_id: r.camp_fk_nacionalidad, fecha_nacimiento: r.camp_nacimiento,
        sexoId: r.camp_fk_sexo,
        provincia_id: r.camp_fk_provincia, canton_id: r.camp_fk_canton,
        distrito_id: r.camp_fk_distrito, barrio_id: r.camp_fk_barrio,
        foto_url: r.camp_imagen,
      }, sexoMap);
    }
    resumen.personas += n;
    console.log(`  tb_inquilinos_no_nacionales → ${n}`);
  } else console.log('  · tb_inquilinos_no_nacionales no existe');

  const solicitantes = await mysqlAll('tb_solicitante');
  if (solicitantes) {
    let n = 0;
    for (const r of solicitantes) {
      if (!r.camp_cedula) continue;
      n += await upsertPersona({
        identificacion: r.camp_cedula,
        nombre: r.camp_nombre, apellido1: r.camp_apellido_uno, apellido2: r.camp_apellido_dos,
        fecha_nacimiento: r.camp_nacimiento,
        provincia_id: r.camp_provincia, canton_id: r.camp_canton,
        distrito_id: r.camp_distrito, barrio_id: r.camp_barrio,
      }, sexoMap);
    }
    resumen.personas += n;
    console.log(`  tb_solicitante → ${n}`);
  } else console.log('  · tb_solicitante no existe');

  if (!seco) {
    const q = await pool.query(`SELECT count(*)::int AS n FROM personas`);
    console.log(`  TOTAL personas en destino: ${q.rows[0].n}`);
  }
}

// ----------------------------------------------------------------------------
// PASO 3 — Usuarios
// ----------------------------------------------------------------------------

async function pasoUsuarios() {
  log('Usuarios');
  const rows = await mysqlAll('users');
  if (!rows) { console.log('  · tabla `users` no existe'); return; }

  const porEmail = new Map();
  for (const r of rows) {
    let email = (r.user_email || '').toLowerCase().trim();
    if (!email) email = `u${r.user_id}@legacy.laprotec`;
    if (porEmail.has(email)) continue;
    porEmail.set(email, r);
  }

  let n = 0;
  for (const [email, r] of porEmail) {
    const nombre = [r.firstname, r.lastname].filter(Boolean).join(' ')
      || r.nombre_completo || 'Usuario legacy';
    const rol = /admin/i.test(r.access || '') ? 'admin'
      : /agen/i.test(r.access || '') ? 'agencia' : 'propietario';
    const inactivo = /inactiv|susp|baja|cancel|venc|expir/i.test(r.status || '');
    n += await upsert(
      `INSERT INTO usuarios (email, nombre, identificacion, telefono, avatar_url, rol, activo, ultimo_acceso)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (email) DO NOTHING`,
      [email, nombre, r.document || null, r.telephone || null, r.img_user || null,
       rol, !inactivo, r.date_added ?? null],
      `usuario ${email}`,
    );
  }
  resumen.usuarios = n;
  console.log(`  users → ${porEmail.size} emails únicos (${n} nuevos)`);

  if (!seco) {
    const q = await pool.query(`SELECT count(*)::int AS n FROM usuarios`);
    console.log(`  TOTAL usuarios en destino: ${q.rows[0].n}`);

    // Enlazar persona propia por cédula
    const l = await pool.query(`
      UPDATE usuarios u SET persona_id = p.id
      FROM personas p
      WHERE p.identificacion = u.identificacion AND u.persona_id IS NULL`);
    console.log(`  personas enlazadas a usuarios: ${l.rowCount}`);

    const s = await pool.query(`SELECT setval(pg_get_serial_sequence('usuarios','id'), COALESCE((SELECT max(id) FROM usuarios), 1))`);
    void s;
  }

  if (CREAR_ACCOUNTS) await crearCuentasAuth();
}

// Crea identidades en Supabase Auth (contraseña aleatoria; el usuario la resetea).
async function crearCuentasAuth() {
  const cuentas = (await pool.query(
    `SELECT id, email, nombre FROM usuarios WHERE auth_user_id IS NULL AND activo`,
  )).rows;
  let ok = 0, fallo = 0;
  console.log(`  Creando en Supabase Auth: 0/${cuentas.length}`);
  for (const c of cuentas) {
    const password = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: c.email, password, email_confirm: true,
      user_metadata: { nombre: c.nombre },
    });
    if (error) {
      if (/already|registered|duplicate/i.test(error.message)) {
        const lista = (await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users;
        const existente = lista.find((u) => u.email?.toLowerCase() === c.email.toLowerCase());
        if (existente) {
          await pool.query(`UPDATE usuarios SET auth_user_id = $1 WHERE id = $2`, [existente.id, c.id]);
          ok++; continue;
        }
      }
      fallo++;
      console.error(`  ✗ ${c.email}: ${error.message}`);
      continue;
    }
    await pool.query(`UPDATE usuarios SET auth_user_id = $1 WHERE id = $2`, [data.user.id, c.id]);
    ok++;
    if (ok % 50 === 0) console.log(`  Creando en Supabase Auth: ${ok}/${cuentas.length}`);
  }
  console.log(`  Auth: ${ok} ok, ${fallo} fallos`);
}

// ----------------------------------------------------------------------------
// PASO 4 — Reseñas
// ----------------------------------------------------------------------------

async function pasoResenas() {
  log('Reseñas');
  const fichas = await mysqlAll('tb_inquilinos_no_nacionales');
  if (!fichas) { console.log('  · no hay fichas'); return; }

  // Personas destino (ya importadas en pasoPersonas)
  const identFicha = (r) => r.camp_identificacion || `LEGACY-${r.camp_id_inquilino}`;
  const idents = [...new Set(fichas.map(identFicha))];
  const personaMap = new Map();
  if (!seco && idents.length) {
    const q = await pool.query(
      `SELECT id, identificacion FROM personas WHERE identificacion = ANY($1::text[])`,
      [idents],
    );
    for (const r of q.rows) personaMap.set(r.identificacion, r.id);
  }

  // Autores: registrador (id persona LEGACY) → identificacion → usuario;
  // si el registrador no tiene cuenta, se crea una fantasma inactiva.
  const regIds = [...new Set(fichas.map((r) => Number(r.camp_fk_registrador)).filter(Boolean))];
  const autorMap = new Map();
  if (!seco && regIds.length) {
    const legacy = await mysqlRows(
      `SELECT camp_id_persona, camp_identificacion FROM tb_persona WHERE camp_id_persona IN (?)`,
      [regIds],
    );
    const idents = [...new Set(legacy.map((r) => r.camp_identificacion).filter(Boolean))];
    if (idents.length) {
      const q = await pool.query(
        `SELECT id, identificacion, nombre, apellido1 FROM personas WHERE identificacion = ANY($1::text[])`,
        [idents],
      );
      const porIdent = new Map(q.rows.map((r) => [r.identificacion, r]));
      for (const lr of legacy) {
        const pr = porIdent.get(lr.camp_identificacion);
        if (!pr) continue;
        const u = await pool.query(
          `SELECT id FROM usuarios WHERE identificacion = $1 OR persona_id = $2 LIMIT 1`,
          [pr.identificacion, pr.id],
        );
        if (u.rows.length) { autorMap.set(lr.camp_id_persona, u.rows[0].id); continue; }
        const email = `resena-${pr.id}@legacy.laprotec`;
        const ins = await pool.query(
          `INSERT INTO usuarios (email, nombre, persona_id, rol, activo)
           VALUES ($1,$2,$3,'propietario', false)
           ON CONFLICT (email) DO NOTHING RETURNING id`,
          [email, [pr.nombre, pr.apellido1].filter(Boolean).join(' ') || 'Reseñador legacy', pr.id],
        );
        const uId = ins.rows[0]?.id ??
          (await pool.query(`SELECT id FROM usuarios WHERE email = $1`, [email])).rows[0]?.id;
        if (uId) { autorMap.set(lr.camp_id_persona, uId); resumen.usuarios++; }
      }
      const s = await pool.query(`SELECT setval(pg_get_serial_sequence('usuarios','id'), COALESCE((SELECT max(id) FROM usuarios), 1))`);
      void s;
    }
  }

  const siNo = (v) => (v === 0 || v === 1 ? Boolean(v) : null);

  let n = 0, sinPersona = 0, sinAutor = 0;
  const etqRows = [];

  for (const r of fichas) {
    const personaId = personaMap.get(identFicha(r)) ?? null;
    if (!personaId) { sinPersona++; continue; }
    const autorId = (r.camp_fk_registrador && autorMap.get(Number(r.camp_fk_registrador))) || null;
    if (!autorId) { sinAutor++; continue; }

    // Calificación: si el lookup legacy se copió, el id vale; si no, mapear por valor 1-5
    let califId = null;
    if (r.camp_fk_calificacion) {
      const v = Number(r.camp_fk_calificacion);
      if (IDS.calificaciones.has(v)) califId = v;
      else if (v >= 1 && v <= 5) califId = IDS.califPorValor.get(v) ?? null;
    }

    const estado = /ocult|inactiv|archiv|elimin|borrad/i.test(r.camp_estadoText || '') ? 'oculta' : 'publicada';

    n += await upsert(
      `INSERT INTO resenas
         (persona_id, autor_id, tipo, calificacion_id, recomienda, drogas,
          dano_vivienda_id, proceso_judicial_id, tipo_contrato_id, tipo_alquiler_id,
          tiempo_alquiler_id, comentario, estado, fuente, id_fuente)
       VALUES ($1,$2,'inquilino',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'legacy',$13)
       ON CONFLICT (fuente, id_fuente) DO UPDATE SET
         persona_id = EXCLUDED.persona_id,
         autor_id = EXCLUDED.autor_id,
         calificacion_id = EXCLUDED.calificacion_id,
         recomienda = EXCLUDED.recomienda,
         drogas = EXCLUDED.drogas,
         dano_vivienda_id = EXCLUDED.dano_vivienda_id,
         proceso_judicial_id = EXCLUDED.proceso_judicial_id,
         tipo_contrato_id = EXCLUDED.tipo_contrato_id,
         tipo_alquiler_id = EXCLUDED.tipo_alquiler_id,
         tiempo_alquiler_id = EXCLUDED.tiempo_alquiler_id,
         comentario = EXCLUDED.comentario,
         estado = EXCLUDED.estado`,
      [personaId, autorId, califId, siNo(r.camp_fk_recomienda_inquilino), siNo(r.camp_drogas),
       ref(IDS.danos, r.camp_fk_dano_vivienda), ref(IDS.procesos, r.camp_fk_proceso_judicial),
       ref(IDS.tipos_contrato, r.camp_fk_tipo_contrato), ref(IDS.tipos_alquiler, r.camp_fk_tipo_alquiler),
       ref(IDS.tiempos_alquiler, r.camp_fk_tiempo_alquiler),
       r.camp_comentario_adicional ?? null, estado, r.camp_id_inquilino],
      `resena legacy ${r.camp_id_inquilino}`,
    );

    for (const col of ['camp_fk_etiqueta_uno', 'camp_fk_etiqueta_dos', 'camp_fk_etiqueta_tres', 'camp_fk_etiqueta_cuatro']) {
      const v = ref(IDS.etiquetas, r[col]);
      if (v) etqRows.push({ legacyId: Number(r.camp_id_inquilino), etiquetaId: v });
    }
  }
  resumen.resenas = n;
  console.log(`  importadas: ${n} (sin persona: ${sinPersona}, sin autor: ${sinAutor})`);

  if (!seco && etqRows.length) {
    const resenas = (await pool.query(
      `SELECT id, id_fuente FROM resenas WHERE fuente = 'legacy' AND id_fuente = ANY($1::int[])`,
      [[...new Set(etqRows.map((e) => e.legacyId))]],
    )).rows;
    const porFuente = new Map(resenas.map((r) => [r.id_fuente, r.id]));
    let e = 0;
    for (const t of etqRows) {
      const resenaId = porFuente.get(t.legacyId);
      if (!resenaId) continue;
      await pool.query(
        `INSERT INTO resena_etiquetas (resena_id, etiqueta_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [resenaId, t.etiquetaId],
      );
      e++;
    }
    console.log(`  etiquetas vinculadas: ${e}`);
  }

  if (!seco) {
    const q = await pool.query(`SELECT count(*)::int AS n FROM resenas`);
    console.log(`  TOTAL resenas en destino: ${q.rows[0].n}`);
  }
}

// ----------------------------------------------------------------------------
// Ejecución
// ----------------------------------------------------------------------------

console.log('=== Migración legacy MySQL → v2 Postgres ===');
console.log(`Fuente:  ${mysqlCfg.user}@${mysqlCfg.host}:${mysqlCfg.port}/${mysqlCfg.database}`);
console.log(`Destino: ${seco ? 'SECO (sin escribir)' : 'Postgres vía DATABASE_URL'}`);
console.log(`Pasos:   ${PASOS.join(', ')}${CREAR_ACCOUNTS ? ' + crear-accounts' : ''}`);

try {
  if (PASOS.includes('lookups')) await pasoLookups();
  if (PASOS.includes('personas')) await pasoPersonas();
  if (PASOS.includes('usuarios')) await pasoUsuarios();
  if (PASOS.includes('resenas')) await pasoResenas();
  console.log('\n=== Resumen ===');
  console.log(JSON.stringify(resumen, null, 2));
} finally {
  await m.end();
  if (pool) await pool.end();
}
