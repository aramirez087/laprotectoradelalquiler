// ============================================================================
// Migración: MySQL legacy (`laprotec_laprotectora`) → PostgreSQL (Supabase)
// ----------------------------------------------------------------------------
// Uso:
//   node scripts/migrar-legacy.mjs                  # ejecuta todos los pasos
//   node scripts/migrar-legacy.mjs --seco           # valida todo en una transacción que se revierte
//   node scripts/migrar-legacy.mjs --pasos=lookups,personas,usuarios,resenas
//   node scripts/migrar-legacy.mjs --crear-accounts # crea identidades en Supabase Auth
//   node scripts/migrar-legacy.mjs --solo-accesos --crear-accounts # enlaza perfiles ya importados
//   node scripts/migrar-legacy.mjs --solo-accesos --seco # revisa accesos pendientes, solo lectura y sin Auth API
//   Añadir --limite-auth=100 --tiempo-auth=150 para un lote de accesos desde la UI.
//   --despues-auth=<id> continúa el lote anterior, sin bloquearse en cuentas fallidas.
//   node scripts/migrar-legacy.mjs --probar-claves   # solo verifica el detector de claves
//
// Variables de entorno:
//   LEGACY_MYSQL_HOST / PORT / USER / PASSWORD / DB  (fuente MySQL)
//   DATABASE_URL                                      (Postgres destino, conexión directa)
//   NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL) y
//   SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY)  (solo con --crear-accounts)
//
// Idempotente: puede correrse varias veces (upsert por clave natural).
// Los catálogos se enlazan por significado, nunca por coincidencia de ids.
// Las referencias sin catálogo se convierten en NULL y se informan en el resumen.
// ============================================================================

import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import pg from 'pg';
import { importarCatalogos } from './legacy-catalogos.mjs';
import { configuracionPostgres } from './postgres-config.mjs';
import { existeTablaLegacy } from './legacy-tablas.mjs';

const args = process.argv.slice(2);
if (args.some((a) => !['--seco', '--crear-accounts', '--probar-claves', '--solo-accesos'].includes(a)
  && !['--pasos=', '--limite-auth=', '--tiempo-auth=', '--despues-auth='].some((prefijo) => a.startsWith(prefijo)))) {
  throw new Error('Opción de migración desconocida.');
}
const seco = args.includes('--seco');
const SOLO_ACCESOS = args.includes('--solo-accesos');
const pasoArg = args.find((a) => a.startsWith('--pasos='));
if (SOLO_ACCESOS && ((!args.includes('--crear-accounts') && !seco) || pasoArg)) {
  throw new Error('--solo-accesos requiere --crear-accounts o --seco y no admite --pasos.');
}
function limiteAuth(nombre, maximo) {
  const valores = args.filter((a) => a.startsWith(`${nombre}=`));
  if (!valores.length) return Infinity;
  const valor = valores[0].slice(nombre.length + 1);
  if (valores.length !== 1 || !/^\d+$/.test(valor) || Number(valor) < 1 || Number(valor) > maximo
    || !args.includes('--crear-accounts') || seco) throw new Error(`${nombre} requiere --crear-accounts y un entero entre 1 y ${maximo}.`);
  return Number(valor);
}
const LIMITE_AUTH = limiteAuth('--limite-auth', 1000);
const TIEMPO_AUTH_MS = limiteAuth('--tiempo-auth', 3600) * 1000;
const cursores = args.filter((a) => a.startsWith('--despues-auth='));
const valorCursor = cursores[0]?.slice('--despues-auth='.length) ?? '0';
if (cursores.length > 1 || !/^\d+$/.test(valorCursor) || Number(valorCursor) > 2147483647
  || (cursores.length && (!SOLO_ACCESOS || seco))) throw new Error('--despues-auth requiere --solo-accesos sin --seco y un entero entre 0 y 2147483647.');
const DESPUES_AUTH = Number(valorCursor);
const ordenPasos = ['lookups', 'personas', 'usuarios', 'resenas'];
const solicitados = pasoArg ? pasoArg.split('=').pop().split(',') : ordenPasos;
if (solicitados.some((paso) => !ordenPasos.includes(paso))) throw new Error('Paso de migración desconocido.');
// Importar una etapa incluye sus dependencias para no borrar referencias.
const PASOS = SOLO_ACCESOS ? [] : ordenPasos.slice(0, Math.max(...solicitados.map((p) => ordenPasos.indexOf(p))) + 1);
const CREAR_ACCOUNTS = args.includes('--crear-accounts') && !seco;

// Carga .env.local (convención Next.js) y, si existe, .env; no sobreescribe lo ya definido
for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(new URL(`../${f}`, import.meta.url)); } catch { /* opcional */ }
}

const SUPABASE_URL_ADMIN = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY_ADMIN = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

const mysqlCfg = {
  host: process.env.LEGACY_MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.LEGACY_MYSQL_PORT ?? 3306),
  user: process.env.LEGACY_MYSQL_USER ?? 'root',
  password: process.env.LEGACY_MYSQL_PASSWORD ?? '',
  database: process.env.LEGACY_MYSQL_DB ?? 'laprotec_laprotectora',
  connectionLimit: 1,
  connectTimeout: 15_000,
  dateStrings: true,
  // El legacy mezcla latin1/utf8/utf8mb4: forzar utf8mb4 para decodificar bien
  charset: 'utf8mb4',
};

assertClasificacion();
if (args.includes('--probar-claves')) {
  console.log('clasificarSecreto ok');
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. La simulación también valida las restricciones del destino.');
  process.exit(1);
}
if (CREAR_ACCOUNTS && (!SUPABASE_URL_ADMIN || !SUPABASE_KEY_ADMIN)) {
  console.error('--crear-accounts requiere NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL) y SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}
if (CREAR_ACCOUNTS) {
  const destino = new URL(process.env.DATABASE_URL);
  const auth = new URL(SUPABASE_URL_ADMIN);
  const refAuth = /^([a-z0-9]+)\.supabase\.co$/.exec(auth.hostname)?.[1];
  const refDb = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(destino.hostname)?.[1]
    ?? (destino.hostname.endsWith('.pooler.supabase.com')
      ? /^postgres\.([a-z0-9]+)$/.exec(decodeURIComponent(destino.username))?.[1] : null);
  if (refAuth && refDb && refAuth !== refDb) throw new Error('La conexión Postgres y Supabase Auth corresponden a proyectos distintos. Revise la configuración del servidor.');
}

const m = await mysql.createPool(mysqlCfg);
// Un único cliente: BEGIN/COMMIT y todas las escrituras comparten conexión.
const pool = new pg.Client({ ...configuracionPostgres(process.env.DATABASE_URL), connectionTimeoutMillis: 15_000 });
const supabaseAdmin = CREAR_ACCOUNTS
  ? (await import('@supabase/supabase-js')).createClient(SUPABASE_URL_ADMIN, SUPABASE_KEY_ADMIN, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: (url, opciones = {}) => fetch(url, {
        ...opciones,
        signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(opciones.signal ? [opciones.signal] : [])]),
      }) },
    })
  : null;

const log = (msg) => console.log(`\n▸ ${msg}`);
const resumen = {
  estado: seco ? 'simulacion' : 'completada',
  advertencias: [],
  auth: { creadas: 0, fallidas: 0 },
  lookups: {},
  personas: 0,
  usuarios: 0,
  resenas: 0,
  fichas: { leidas: 0, archivadas: 0, consolidadas: 0, conservadas: 0 },
  claves: { bcrypt: 0, anterior: 0, restablecer: 0 },
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function mysqlRows(sql, params = []) {
  const [rows] = await m.query(sql, params);
  return rows;
}

const tablasOrigen = new Map();
async function mysqlTableExists(name) {
  if (!tablasOrigen.has(name)) tablasOrigen.set(name, await existeTablaLegacy(m, name));
  return tablasOrigen.get(name);
}

async function mysqlFindTable(patterns) {
  for (const name of patterns) if (await mysqlTableExists(name)) return name;
  return null;
}

// Columns consumed from the supplied legacy/schema.sql. SELECTing them also
// validates empty tables; SELECT * alone would hide incompatible schemas.
const COLUMNAS_ORIGEN = {
  tb_persona: 'camp_id_persona camp_identificacion camp_nombreUno camp_nombreDOs camp_apellidoUno camp_apellidoDos camp_fk_nacionalidad camp_fk_domicilio camp_fechaNacimiento camp_fk_sexo camp_idSolicitud',
  tb_inquilinos_no_nacionales: 'camp_id_inquilino camp_identificacion camp_nombre camp_apellido_uno camp_apellido_dos camp_fk_nacionalidad camp_nacimiento camp_fk_sexo camp_imagen camp_fk_provincia camp_fk_canton camp_fk_distrito camp_fk_barrio camp_fk_tipo_contrato camp_fk_tipo_alquiler camp_fk_tiempo_alquiler camp_fk_etiqueta_uno camp_fk_etiqueta_dos camp_fk_etiqueta_tres camp_fk_etiqueta_cuatro camp_fk_calificacion camp_fk_proceso_judicial camp_fk_dano_vivienda camp_fk_recomienda_inquilino camp_comentario_adicional camp_fecha_registro camp_fk_registrador camp_drogas camp_estado camp_estadoText camp_fk_conducta',
  tb_solicitante: 'camp_id camp_email camp_cedula camp_telefono_uno camp_nombre camp_apellido_uno camp_apellido_dos camp_nacimiento camp_nacionalidad camp_sexo camp_provincia camp_canton camp_distrito camp_barrio',
  users: 'user_id user_email firstname lastname nombre_completo status document telephone img_user access date_added user_password_hash',
  tb_resenador: 'camp_id_resenador camp_identificacion_resenador',
};
const filasOrigen = new Map();
async function mysqlAll(table) {
  if (filasOrigen.has(table)) return filasOrigen.get(table);
  if (!(await mysqlTableExists(table))) return null;
  const columnas = COLUMNAS_ORIGEN[table].split(' ').map((c) => `\`${c}\``).join(', ');
  // Validate the consumed columns, but archive every original ficha column,
  // including fields that the current application does not interpret.
  const completa = table === 'tb_inquilinos_no_nacionales';
  if (completa) await mysqlRows(`SELECT ${columnas} FROM \`${table}\` LIMIT 0`);
  const rows = await mysqlRows(`SELECT ${completa ? '*' : columnas} FROM \`${table}\` ORDER BY 1`);
  filasOrigen.set(table, rows);
  return rows;
}

// Advertencias agregadas: no imprimir datos personales ni una línea por fila.
function avisar(codigo, mensaje, cantidad = 1) {
  const aviso = resumen.advertencias.find((a) => a.codigo === codigo);
  if (aviso) aviso.cantidad += cantidad;
  else resumen.advertencias.push({ codigo, mensaje, cantidad });
}

// PostgreSQL rejects duplicate conflict keys in one INSERT. Flush on a
// repeated key so the original merge order is preserved, including COALESCE.
let lote = null;
async function guardarLote() {
  if (!lote) return;
  const { sql, rows, label } = lote;
  lote = null;
  const match = /VALUES\s*(\([\s\S]*?\))\s*ON CONFLICT/.exec(sql);
  if (!match) throw new Error('INSERT de migración sin formato de lote.');
  const valores = rows.map((row, i) => match[1].replace(/\$(\d+)/g, (_, n) => `$${Number(n) + i * row.length}`));
  const consulta = sql.slice(0, match.index) + `VALUES ${valores.join(', ')} ON CONFLICT` + sql.slice(match.index + match[0].length);
  try {
    await pool.query(consulta, rows.flat());
  } catch (e) {
    // PostgreSQL detail/message can contain personal data. Only expose known
    // constraint names; retain enough information to diagnose future failures.
    const conocidas = new Set(['resenas_pkey', 'resenas_fuente_id_fuente_key', 'resenas_autor_persona_unica', 'resenas_legacy_originales_pkey']);
    const restriccion = conocidas.has(e.constraint) ? `, restricción ${e.constraint}` : '';
    const codigo = /^[A-Z0-9]{5}$/.test(e.code ?? '') ? e.code : 'desconocido';
    throw new Error(`${label}: no se pudo guardar el lote (código ${codigo}${restriccion}).`);
  }
}

async function upsert(sql, row, label, clave = row[0]) {
  if (lote && (lote.sql !== sql || lote.claves.has(clave) || lote.rows.length >= 500)) await guardarLote();
  lote ??= { sql, rows: [], claves: new Set(), label };
  lote.rows.push(row);
  lote.claves.add(clave);
  return 1;
}

function ref(mapa, valor) {
  if (valor == null || valor === '') return null;
  if (Number(valor) === 0 && !mapa.has(0)) return null;
  const id = mapa.get(Number(valor));
  if (id == null) {
    const tabla = Object.keys(IDS).find((k) => IDS[k] === mapa) ?? 'catalogo';
    avisar(`referencia_${tabla}`, `${tabla}: referencias legacy sin equivalencia; se dejaron vacías, sin asignar valores de demostración.`);
  }
  return id ?? null;
}

function texto(valor) {
  return String(valor ?? '').trim() || null;
}

function fecha(valor, conHora = false) {
  if (!valor) return null;
  const s = String(valor);
  const dia = s.slice(0, 10);
  const parsed = new Date(`${dia}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dia || dia.startsWith('0000')) {
    avisar('fecha_invalida', 'Fechas vacías o inválidas del sistema anterior se conservaron como desconocidas.');
    return null;
  }
  // MySQL DATE no pasa por Date/timezone (evita cambiar el día de nacimiento).
  return conHora ? `${s.replace(' ', 'T')}${zonaLegacy}` : dia;
}

const zonaLegacy = process.env.LEGACY_MYSQL_TIMEZONE || '-06:00';
if (!/^[+-](?:0\d|1[0-3]):[0-5]\d$/.test(zonaLegacy)) throw new Error('LEGACY_MYSQL_TIMEZONE debe tener formato ±HH:MM.');
const identFicha = (r) => texto(r.camp_identificacion) || `LEGACY-${r.camp_id_inquilino}`;

function emailDe(valor) {
  const email = String(valor ?? '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function emailSintetico(email) {
  return !email || email.endsWith('@legacy.laprotec');
}

function digitosDe(valor) {
  const v = texto(valor);
  return v && /^[0-9 -]+$/.test(v) ? v.replace(/\D/g, '') : '';
}

function rolDe(texto) {
  const t = String(texto ?? '');
  if (/admin/i.test(t)) return 'admin';
  if (/agen/i.test(t)) return 'agencia';
  if (/inquilin/i.test(t)) return 'inquilino';
  return 'propietario';
}

function rangoRol(rol) {
  return { admin: 3, agencia: 2, propietario: 1, inquilino: 0 }[rol] ?? 0;
}

/**
 * Detecta si el valor guardado en el legacy se puede usar para entrar.
 * No imprime el valor. bcrypt y argon2 los acepta Supabase como hash.
 * Un texto que no parece hash es la clave que la persona escribía.
 * md5, sha y formatos desconocidos no se pueden verificar aquí: esa persona
 * elige una clave nueva con "Olvidé mi clave".
 */
function clasificarSecreto(valor) {
  const s = String(valor ?? '').trim();
  if (!s) return { tipo: 'vacio' };
  const bcrypt = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/.exec(s);
  if (bcrypt && Number(bcrypt[1]) >= 4 && Number(bcrypt[1]) <= 31) return { tipo: 'bcrypt', hash: s };
  const argon = /^\$argon2(?:id|i)\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(s);
  if (argon && Number(argon[1]) > 0 && Number(argon[1]) <= 1024 * 1024
    && Number(argon[2]) > 0 && Number(argon[2]) <= 20 && Number(argon[3]) > 0 && Number(argon[3]) <= 16
    && [argon[4], argon[5]].every((v) => Buffer.from(v, 'base64').toString('base64').replace(/=+$/, '') === v)) {
    return { tipo: 'argon', hash: s };
  }
  if (/^[a-f0-9]{32}$/i.test(s)) return { tipo: 'md5' };
  if (/^[a-f0-9]{40}$/i.test(s)) return { tipo: 'sha1' };
  if (/^[a-f0-9]{64}$/i.test(s)) return { tipo: 'sha256' };
  if (s.startsWith('$') || Buffer.byteLength(String(valor), 'utf8') > 72) return { tipo: 'otra' };
  if (s.length < 6) return { tipo: 'corta' };
  return { tipo: 'plana', clave: String(valor) };
}

function assertClasificacion() {
  const casos = [
    ['$2y$10$' + 'a'.repeat(53), 'bcrypt'],
    ['$2a$10$' + 'a'.repeat(53), 'bcrypt'],
    ['$argon2id$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA', 'argon'],
    ['$argon2d$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA', 'otra'],
    ['$argon2id$v=16$m=1,t=1,p=1$c2FsdA$aGFzaA', 'otra'],
    ['$2a$99$' + 'a'.repeat(53), 'otra'],
    ['a'.repeat(32), 'md5'],
    ['a'.repeat(40), 'sha1'],
    ['ab', 'corta'],
    ['clave12', 'plana'],
    ['', 'vacio'],
    ['$P$Bhashdesconocido', 'otra'],
    ['x'.repeat(80), 'otra'],
    ['é'.repeat(37), 'otra'],
  ];
  for (const [valor, tipo] of casos) {
    const obtuvo = clasificarSecreto(valor).tipo;
    if (obtuvo !== tipo) {
      console.error(`clasificarSecreto fallo: esperaba ${tipo}, obtuvo ${obtuvo}`);
      process.exit(1);
    }
  }
}

function secretoVacio() {
  return { tipo: 'vacio' };
}

function tomarSecreto(actual, incoming, incomingEsLogin) {
  if (!incoming || incoming.tipo === 'vacio') return actual ?? secretoVacio();
  const usable = incoming.tipo === 'bcrypt' || incoming.tipo === 'argon' || incoming.tipo === 'plana';
  if (incomingEsLogin && usable) return incoming;
  if (actual && (actual.tipo === 'bcrypt' || actual.tipo === 'argon' || actual.tipo === 'plana')) return actual;
  if (usable) return incoming;
  if (!actual || actual.tipo === 'vacio') return incoming;
  return actual;
}

function cuentaNueva(parcial) {
  return {
    email: parcial.email,
    nombre: parcial.nombre || 'Usuario legacy',
    identificacion: parcial.identificacion || null,
    telefono: parcial.telefono || null,
    avatar: parcial.avatar || null,
    rol: parcial.rol || 'propietario',
    activo: parcial.activo !== false,
    ultimoAcceso: parcial.ultimoAcceso ?? null,
    secreto: parcial.secreto ?? secretoVacio(),
    esLogin: parcial.esLogin === true,
  };
}

function fusionarCuenta(base, extra, extraEsLogin) {
  if (extra.identificacion && !base.identificacion) base.identificacion = extra.identificacion;
  if (extra.telefono && !base.telefono) base.telefono = extra.telefono;
  if (extra.avatar && !base.avatar) base.avatar = extra.avatar;
  if (extra.nombre && (base.nombre === 'Usuario legacy' || base.nombre === 'Usuario')) base.nombre = extra.nombre;
  if (rangoRol(extra.rol) > rangoRol(base.rol)) base.rol = extra.rol;
  if (extraEsLogin) base.activo = extra.activo;
  else if (extra.activo) base.activo = true;
  base.secreto = tomarSecreto(base.secreto, extra.secreto, extraEsLogin);
  if (extra.ultimoAcceso && !base.ultimoAcceso) base.ultimoAcceso = extra.ultimoAcceso;
}

function bucketClave(secreto) {
  if (secreto?.tipo === 'bcrypt' || secreto?.tipo === 'argon') return 'bcrypt';
  if (secreto?.tipo === 'plana') return 'anterior';
  return 'restablecer';
}

let IDS;
async function pasoLookups() {
  log('Catálogos y equivalencias legacy');
  const { mapas, cantidades } = await importarCatalogos({
    db: pool, buscarTabla: mysqlFindTable, filas: mysqlRows, avisar,
  });
  IDS = {
    ...mapas,
    danos: mapas.danos_vivienda,
    procesos: mapas.procesos_judiciales,
  };
  resumen.lookups = cantidades;
}

// ----------------------------------------------------------------------------
// PASO 2 — Personas
// ----------------------------------------------------------------------------

function normalizaSexo(legacyId, mapa) {
  if (legacyId == null) return null;
  const v = mapa.get(Number(legacyId));
  if (!v) {
    avisar('sexo_desconocido', 'Referencias de sexo sin equivalencia se conservaron como desconocidas.');
    return null;
  }
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
  if (!(await mysqlTableExists('tb_ubicacion'))) return map;
  const ubi = await mysqlRows('SELECT * FROM tb_ubicacion WHERE camp_codi IS NOT NULL');
  const tablas = {};
  for (const tabla of ['provincias', 'cantones', 'distritos']) {
    tablas[tabla] = (await pool.query(`SELECT * FROM ${tabla}`)).rows;
  }
  const buscar = (tabla, nombre, padre, padreId) => {
    if (!texto(nombre) || (padre && padreId == null)) return null;
    const candidatas = tablas[tabla].filter((r) =>
      r.nombre.trim().toLowerCase() === texto(nombre).toLowerCase() && (!padre || r[padre] === padreId));
    return candidatas.length === 1 ? candidatas[0].id : null;
  };
  for (const u of ubi) {
    const provincia_id = buscar('provincias', u.camp_Provincia);
    const canton_id = buscar('cantones', u.camp_Canton, 'provincia_id', provincia_id);
    const distrito_id = buscar('distritos', u.camp_Distrito, 'canton_id', canton_id);
    map.set(u.camp_codi, { provincia_id, canton_id, distrito_id, ubicacionDestino: true });
  }
  return map;
}

const SQL_UPSERT_PERSONA = `
  INSERT INTO personas
    (identificacion, nombre, nombre2, apellido1, apellido2, pais_id,
     fecha_nacimiento, sexo, provincia_id, canton_id, distrito_id, barrio_id, foto_url)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
  ON CONFLICT (identificacion) DO UPDATE SET
    nombre = COALESCE(NULLIF(EXCLUDED.nombre, 'Sin nombre legacy'), personas.nombre),
    nombre2 = COALESCE(EXCLUDED.nombre2, personas.nombre2),
    apellido1 = COALESCE(NULLIF(EXCLUDED.apellido1, 'Sin apellido legacy'), personas.apellido1),
    apellido2 = COALESCE(EXCLUDED.apellido2, personas.apellido2),
    pais_id = COALESCE(EXCLUDED.pais_id, personas.pais_id),
    fecha_nacimiento = COALESCE(EXCLUDED.fecha_nacimiento, personas.fecha_nacimiento),
    sexo = COALESCE(EXCLUDED.sexo, personas.sexo),
    provincia_id = COALESCE(EXCLUDED.provincia_id, personas.provincia_id),
    canton_id = COALESCE(EXCLUDED.canton_id, personas.canton_id),
    distrito_id = COALESCE(EXCLUDED.distrito_id, personas.distrito_id),
    barrio_id = COALESCE(EXCLUDED.barrio_id, personas.barrio_id),
    foto_url = COALESCE(EXCLUDED.foto_url, personas.foto_url)`;

const personasProcesadas = new Set();
async function upsertPersona(p, sexoMap) {
  personasProcesadas.add(p.identificacion);
  if (!texto(p.nombre) || !texto(p.apellido1)) avisar('persona_incompleta', 'Personas sin nombre o apellido se conservaron con una indicación de dato faltante.');
  return upsert(SQL_UPSERT_PERSONA, [
    p.identificacion,
    texto(p.nombre) || 'Sin nombre legacy', texto(p.nombre2), texto(p.apellido1) || 'Sin apellido legacy', texto(p.apellido2),
    ref(IDS.paises, p.pais_id),
    fecha(p.fecha_nacimiento),
    p.sexo ?? normalizaSexo(p.sexoId, sexoMap),
    p.ubicacionDestino ? p.provincia_id : ref(IDS.provincias, p.provincia_id),
    p.ubicacionDestino ? p.canton_id : ref(IDS.cantones, p.canton_id),
    p.ubicacionDestino ? p.distrito_id : ref(IDS.distritos, p.distrito_id), ref(IDS.barrios, p.barrio_id),
    p.foto_url ?? null,
  ], 'persona legacy');
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
        identificacion: texto(r.camp_identificacion) || `PERSONA-LEGACY-${r.camp_id_persona}`,
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
        identificacion: identFicha(r),
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
      if (!texto(r.camp_cedula)) {
        avisar('solicitante_sin_cedula', 'Solicitantes sin cédula se conservaron con un identificador de origen.');
      }
      n += await upsertPersona({
        identificacion: texto(r.camp_cedula) || `SOLICITANTE-LEGACY-${r.camp_id}`,
        nombre: r.camp_nombre, apellido1: r.camp_apellido_uno, apellido2: r.camp_apellido_dos,
        fecha_nacimiento: r.camp_nacimiento, pais_id: r.camp_nacionalidad, sexo: r.camp_sexo === 0 ? 'masculino' : r.camp_sexo === 1 ? 'femenino' : null,
        provincia_id: r.camp_provincia, canton_id: r.camp_canton,
        distrito_id: r.camp_distrito, barrio_id: r.camp_barrio,
      }, sexoMap);
    }
    resumen.personas += n;
    console.log(`  tb_solicitante → ${n}`);
  } else console.log('  · tb_solicitante no existe');

  await guardarLote();
  {
    const q = await pool.query(`SELECT count(*)::int AS n FROM personas`);
    console.log(`  TOTAL personas en destino: ${q.rows[0].n}`);
  }
}

// ----------------------------------------------------------------------------
// PASO 3 — Usuarios
// ----------------------------------------------------------------------------

async function cargarCuentasLegacy(tolerarConflictos = false) {
  const porEmail = new Map();
  const sinCorreo = [];

  const rows = await mysqlAll('users');
  if (rows) {
    for (const r of rows) {
      const emailReal = emailDe(r.user_email);
      const email = emailReal ?? `u${r.user_id}@legacy.laprotec`;
      const nombre = [r.firstname, r.lastname].filter(Boolean).join(' ')
        || r.nombre_completo || 'Usuario legacy';
      const inactivo = /inactiv|susp|baja|cancel|venc|expir/i.test(r.status || '');
      const cuenta = cuentaNueva({
        email,
        nombre,
        identificacion: texto(r.document),
        telefono: r.telephone || null,
        avatar: r.img_user || null,
        rol: rolDe(r.access),
        activo: !inactivo && !emailSintetico(email),
        ultimoAcceso: fecha(r.date_added, true),
        secreto: clasificarSecreto(r.user_password_hash),
      });
      if (porEmail.has(email)) {
        const anterior = porEmail.get(email);
        const mismoDocumento = texto(anterior.identificacion) === texto(cuenta.identificacion)
          || (digitosDe(cuenta.identificacion).length >= 6 && digitosDe(cuenta.identificacion) === digitosDe(anterior.identificacion));
        if (!mismoDocumento) {
          if (!tolerarConflictos) throw new Error(`users#${r.user_id}: correo compartido por identificaciones distintas. Corrija el origen antes de importar.`);
          anterior.conflicto = true;
          continue;
        }
        avisar('correo_duplicado', 'Se consolidaron filas repetidas con el mismo correo e identificación.');
        fusionarCuenta(anterior, cuenta, false);
      } else if (emailReal) porEmail.set(email, cuenta);
      else sinCorreo.push(cuenta);
    }
  } else console.log('  · tabla `users` no existe');

  if (await mysqlTableExists('tb_login')) {
    const logins = await mysqlRows(
      `SELECT camp_id_login, camp_fk_persona, camp_clave, camp_activo, camp_fecha_ingreso FROM tb_login`,
    );
    const personas = (await mysqlTableExists('tb_persona'))
      ? await mysqlRows(
        `SELECT camp_id_persona, camp_identificacion, camp_nombreUno, camp_nombreDOs,
                camp_apellidoUno, camp_apellidoDos, camp_idSolicitud
         FROM tb_persona`,
      )
      : [];
    const solicitantes = (await mysqlTableExists('tb_solicitante'))
      ? await mysqlRows(
        `SELECT camp_id, camp_email, camp_cedula, camp_telefono_uno, camp_nombre,
                camp_apellido_uno, camp_apellido_dos
         FROM tb_solicitante`,
      )
      : [];
    const permisos = (await mysqlTableExists('tb_permiso'))
      ? await mysqlRows(`SELECT camp_fk_persona, camp_nombre FROM tb_permiso`)
      : [];

    const personaPorId = new Map(personas.map((p) => [Number(p.camp_id_persona), p]));
    const solPorId = new Map(solicitantes.map((s) => [Number(s.camp_id), s]));
    const solPorCedula = new Map();
    for (const s of solicitantes) {
      const d = digitosDe(s.camp_cedula);
      if (d.length >= 6) solPorCedula.set(d, solPorCedula.has(d) ? null : s);
    }
    const permisoPorPersona = new Map(permisos.map((p) => [Number(p.camp_fk_persona), p.camp_nombre]));
    const cuentaPorCedula = new Map();
    for (const cuenta of porEmail.values()) {
      const d = digitosDe(cuenta.identificacion);
      if (d.length >= 6) cuentaPorCedula.set(d, cuentaPorCedula.has(d) ? null : cuenta);
    }

    let conLogin = 0;
    for (const login of logins) {
      const persona = login.camp_fk_persona == null ? null : personaPorId.get(Number(login.camp_fk_persona));
      const ident = texto(persona?.camp_identificacion);
      const digitos = digitosDe(ident);
      const sol = (persona?.camp_idSolicitud && solPorId.get(Number(persona.camp_idSolicitud)))
        || (digitos.length >= 6 ? solPorCedula.get(digitos) : null)
        || null;
      const email = emailDe(sol?.camp_email);
      const nombrePersona = [persona?.camp_nombreUno, persona?.camp_nombreDOs, persona?.camp_apellidoUno, persona?.camp_apellidoDos]
        .filter(Boolean).join(' ');
      const nombreSol = [sol?.camp_nombre, sol?.camp_apellido_uno, sol?.camp_apellido_dos].filter(Boolean).join(' ');
      const extra = cuentaNueva({
        email: email ?? `login-${login.camp_fk_persona ?? `id-${login.camp_id_login}`}@legacy.laprotec`,
        nombre: nombreSol || nombrePersona || 'Usuario legacy',
        identificacion: ident,
        telefono: sol?.camp_telefono_uno || null,
        rol: rolDe(permisoPorPersona.get(Number(login.camp_fk_persona))),
        activo: Number(login.camp_activo) === 1,
        ultimoAcceso: fecha(login.camp_fecha_ingreso, true),
        secreto: clasificarSecreto(login.camp_clave),
        esLogin: true,
      });
      const destino = (email && porEmail.get(email))
        || (!email && digitos.length >= 6 ? cuentaPorCedula.get(digitos) : null)
        || null;
      if (destino) {
        if (ident && destino.identificacion && ident !== destino.identificacion
          && !(digitos.length >= 6 && digitos === digitosDe(destino.identificacion))) {
          if (!tolerarConflictos) throw new Error(`tb_login#${login.camp_fk_persona}: correo asociado a otra identificación. Corrija el origen antes de importar.`);
          destino.conflicto = true;
          continue;
        }
        fusionarCuenta(destino, extra, true);
        if (email && emailSintetico(destino.email)) {
          porEmail.delete(destino.email);
          destino.email = email;
          porEmail.set(email, destino);
        }
      } else if (email) {
        porEmail.set(email, extra);
        if (digitos.length >= 6) cuentaPorCedula.set(digitos, cuentaPorCedula.has(digitos) ? null : extra);
      } else {
        sinCorreo.push(extra);
      }
      conLogin++;
    }
    console.log(`  tb_login → ${conLogin} accesos`);
  } else console.log('  · tb_login no existe');

  for (const cuenta of sinCorreo) {
    const digitos = digitosDe(cuenta.identificacion);
    const candidatas = [...porEmail.values()].filter((c) => digitos.length >= 6 && digitosDe(c.identificacion) === digitos);
    const ya = candidatas.length === 1 ? candidatas[0] : null;
    if (ya) fusionarCuenta(ya, cuenta, cuenta.esLogin);
    else if (!porEmail.has(cuenta.email)) porEmail.set(cuenta.email, cuenta);
  }

  return [...porEmail.values()].map((c) => ({ ...c, activo: c.activo && !emailSintetico(c.email) }));
}

async function pasoUsuarios() {
  log('Usuarios');
  const cuentas = await cargarCuentasLegacy();
  resumen.claves = { bcrypt: 0, anterior: 0, restablecer: 0 };
  for (const cuenta of cuentas) {
    if (!cuenta.activo || emailSintetico(cuenta.email)) continue;
    resumen.claves[bucketClave(cuenta.secreto)]++;
  }

  const existentes = (await pool.query('SELECT email, identificacion FROM usuarios WHERE lower(email) = ANY($1::text[])', [cuentas.map((c) => c.email)])).rows;
  for (const actual of existentes) {
    const cuenta = cuentas.find((c) => c.email === actual.email.toLowerCase());
    if (actual.email !== cuenta.email) throw new Error('Hay una cuenta de destino con el mismo correo y distinta capitalización. Normalice ese correo antes de importar.');
    if (actual.identificacion && cuenta.identificacion && actual.identificacion !== cuenta.identificacion
      && !(digitosDe(actual.identificacion).length >= 6 && digitosDe(actual.identificacion) === digitosDe(cuenta.identificacion))) {
      throw new Error('Una cuenta de destino comparte correo con otra identificación legacy. Reconcilie esa cuenta antes de importar.');
    }
  }
  let n = 0;
  for (const cuenta of cuentas) {
    n += await upsert(
      `INSERT INTO usuarios (email, nombre, identificacion, telefono, avatar_url, rol, activo, ultimo_acceso)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (email) DO UPDATE SET
         identificacion = COALESCE(usuarios.identificacion, EXCLUDED.identificacion),
         telefono = COALESCE(usuarios.telefono, EXCLUDED.telefono),
         avatar_url = COALESCE(usuarios.avatar_url, EXCLUDED.avatar_url),
         nombre = CASE
           WHEN usuarios.nombre IN ('Usuario legacy', 'Usuario') THEN EXCLUDED.nombre
           ELSE usuarios.nombre
         END,
         rol = CASE
           WHEN usuarios.auth_user_id IS NOT NULL THEN usuarios.rol
           WHEN usuarios.rol = 'admin' OR EXCLUDED.rol = 'admin' THEN 'admin'
           WHEN usuarios.rol = 'agencia' OR EXCLUDED.rol = 'agencia' THEN 'agencia'
           WHEN usuarios.rol = 'propietario' OR EXCLUDED.rol = 'propietario' THEN 'propietario'
           ELSE 'inquilino'
         END,
         activo = CASE
           WHEN usuarios.auth_user_id IS NULL THEN EXCLUDED.activo
           ELSE usuarios.activo
         END`,
      [cuenta.email, cuenta.nombre, cuenta.identificacion, cuenta.telefono, cuenta.avatar,
        cuenta.rol, cuenta.activo, cuenta.ultimoAcceso],
      'usuario legacy',
    );
  }
  resumen.usuarios = n;
  const reales = cuentas.filter((c) => !emailSintetico(c.email)).length;
  const activas = cuentas.filter((c) => c.activo && !emailSintetico(c.email)).length;
  console.log(`  cuentas: ${cuentas.length} (${reales} con correo, ${activas} activas)`);
  console.log(
    `  claves de las activas: ${resumen.claves.bcrypt} hash compatible, ${resumen.claves.anterior} la misma clave, ${resumen.claves.restablecer} tienen que restablecerla`,
  );

  await guardarLote();
  {
    const q = await pool.query(`SELECT count(*)::int AS n FROM usuarios`);
    console.log(`  TOTAL usuarios en destino: ${q.rows[0].n}`);

    // Only a unique candidate on BOTH sides may be linked. Duplicate emails
    // sharing a cédula remain independent accounts, never merged arbitrarily.
    const enlaces = await pool.query(`
      WITH candidatos AS (
        SELECT u.id AS usuario_id, p.id AS persona_id,
          count(*) OVER (PARTITION BY u.id) AS personas,
          count(*) OVER (PARTITION BY p.id) AS usuarios
        FROM usuarios u JOIN personas p ON
          (CASE WHEN p.identificacion ~ '^[0-9 -]+$'
            AND length(regexp_replace(p.identificacion, '[^0-9]', '', 'g')) >= 6
            THEN regexp_replace(p.identificacion, '[^0-9]', '', 'g') ELSE p.identificacion END)
          = (CASE WHEN u.identificacion ~ '^[0-9 -]+$'
            AND length(regexp_replace(u.identificacion, '[^0-9]', '', 'g')) >= 6
            THEN regexp_replace(u.identificacion, '[^0-9]', '', 'g') ELSE u.identificacion END)
        WHERE u.persona_id IS NULL AND u.identificacion IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM usuarios o WHERE o.persona_id = p.id)
      )
      UPDATE usuarios u SET persona_id = c.persona_id FROM candidatos c
      WHERE u.id = c.usuario_id AND c.personas = 1 AND c.usuarios = 1
        AND u.email = ANY($1::text[])`, [cuentas.map((c) => c.email)]);
    console.log(`  personas enlazadas sin ambigüedad: ${enlaces.rowCount}`);
    const ambiguas = await pool.query(`SELECT count(*)::int AS n FROM usuarios
      WHERE persona_id IS NULL AND identificacion IS NOT NULL AND email = ANY($1::text[])`, [cuentas.map((c) => c.email)]);
    if (ambiguas.rows[0].n) avisar('cuenta_sin_enlace', 'Cuentas sin una persona inequívoca; se conservaron sin asignarles otra identidad.', ambiguas.rows[0].n);

  }

  cuentasImportadas = cuentas;
}

function conflictoAcceso() {
  const error = new Error('La identidad del acceso requiere revisión.');
  error.code = 'CONFLICTO_ACCESO';
  return error;
}

function mismaIdentidad(actual, origen) {
  if (!actual || !origen || actual === origen) return true;
  const digitos = digitosDe(actual);
  return digitos.length >= 6 && digitos === digitosDe(origen);
}

async function idAuthPorEmail(email, usuarioId) {
  const q = await pool.query(`SELECT id FROM auth.users WHERE lower(email) = lower($1)`, [email]);
  if (q.rows.length > 1) throw conflictoAcceso();
  const id = q.rows[0]?.id;
  if (!id) return null;
  const propietario = await pool.query('SELECT id FROM usuarios WHERE auth_user_id = $1 AND id <> $2', [id, usuarioId]);
  if (propietario.rows.length) throw conflictoAcceso();
  return id;
}

function claveAleatoria() {
  // ASCII y menos de 72 bytes, con todas las clases de caracteres requeridas.
  return `aA1!${crypto.randomBytes(48).toString('base64url')}`;
}

function requiereNuevaClave(error) {
  return error?.code === 'weak_password'
    || /(?:password.*(?:too short|too long|at least|weak|strength|requirements|leaked)|(?:unsupported|invalid|incompatible).*password.?hash|password.?hash.*(?:unsupported|invalid|incompatible))/i.test(error?.message ?? '');
}

async function crearAcceso(c, secreto) {
  const atributos = { email: emailDe(c.email), email_confirm: true, user_metadata: { nombre: c.nombre } };
  let conservo = false;
  if ((secreto.tipo === 'bcrypt' || secreto.tipo === 'argon') && secreto.hash) {
    atributos.password_hash = secreto.hash;
    conservo = true;
  } else if (secreto.tipo === 'plana' && secreto.clave) {
    atributos.password = secreto.clave;
    conservo = true;
  } else atributos.password = claveAleatoria();

  let respuesta = await supabaseAdmin.auth.admin.createUser(atributos);
  // Reintentar solo un rechazo explícito de la clave, nunca un error de red,
  // permisos o configuración. No modificar ninguna identidad ya existente.
  if (respuesta.error && conservo && requiereNuevaClave(respuesta.error)) {
    delete atributos.password_hash;
    atributos.password = claveAleatoria();
    conservo = false;
    respuesta = await supabaseAdmin.auth.admin.createUser(atributos);
  }
  return { ...respuesta, conservo };
}

// Cada ejecución audita todos los perfiles del destino. Crear un acceso solo
// cambia auth_user_id; nunca reactiva, cambia roles ni reimporta un perfil.
async function crearCuentasAuth(cuentas) {
  const porEmail = new Map(cuentas.map((c) => [c.email, c]));
  const todos = (await pool.query(`SELECT id, email, nombre, identificacion, auth_user_id, activo, rol FROM usuarios ORDER BY id`)).rows;
  const perfiles = SOLO_ACCESOS ? todos : todos.filter((c) => porEmail.has(emailDe(c.email)));
  const porCorreoDestino = new Map();
  for (const c of todos) {
    const email = emailDe(c.email);
    if (email) porCorreoDestino.set(email, (porCorreoDestino.get(email) ?? 0) + 1);
  }
  const acceso = {
    total: perfiles.length, existentes: 0, inactivas: 0, sinCorreo: 0, sinOrigen: 0,
    conflictos: 0, elegibles: 0, creadas: 0, enlazadas: 0, pendientes: 0,
    fallidas: 0, conservadas: 0, restablecer: 0, siguienteId: 0,
  };
  if (SOLO_ACCESOS) resumen.accesos = acceso;
  const candidatos = [];
  for (const c of perfiles) {
    const email = emailDe(c.email);
    const origen = porEmail.get(email);
    if (c.auth_user_id) acceso.existentes++;
    else if (!email || emailSintetico(email)) acceso.sinCorreo++;
    else if (!c.activo) acceso.inactivas++;
    else if (!origen) acceso.sinOrigen++;
    else if (origen.conflicto || porCorreoDestino.get(email) > 1 || !mismaIdentidad(c.identificacion, origen.identificacion)) acceso.conflictos++;
    else {
      candidatos.push(c);
      acceso.elegibles++;
    }
  }
  // La vista previa y la ejecución comparten el mismo examen de identidades.
  // La ejecución vuelve a comprobarlo bajo bloqueo antes de enlazar cada cuenta.
  const authPorCorreo = new Map();
  if (candidatos.length) {
    const identidades = await pool.query(`SELECT a.id, lower(a.email) AS email, u.id AS usuario_id
      FROM auth.users a LEFT JOIN usuarios u ON u.auth_user_id = a.id
      WHERE lower(a.email) = ANY($1::text[])`, [candidatos.map((c) => emailDe(c.email))]);
    for (const identidad of identidades.rows) {
      const grupo = authPorCorreo.get(identidad.email) ?? [];
      grupo.push(identidad);
      authPorCorreo.set(identidad.email, grupo);
    }
  }
  const pendientes = candidatos.filter((c) => {
    const identidades = authPorCorreo.get(emailDe(c.email)) ?? [];
    if (identidades.length > 1 || (identidades[0]?.usuario_id != null && identidades[0].usuario_id !== c.id)) {
      acceso.elegibles--;
      acceso.conflictos++;
      return false;
    }
    return true;
  });
  if (seco) {
    const prevision = {
      crear: 0, enlazar: 0,
      claves: { hashCompatible: 0, texto: 0, restablecer: 0 },
      roles: { admin: 0, propietario: 0, agencia: 0, inquilino: 0 },
      sinDocumentoComparable: 0,
    };
    for (const c of pendientes) {
      prevision.roles[c.rol]++;
      const origen = porEmail.get(emailDe(c.email));
      if (!c.identificacion || !origen.identificacion) prevision.sinDocumentoComparable++;
      if (authPorCorreo.has(emailDe(c.email))) prevision.enlazar++;
      else {
        prevision.crear++;
        const tipo = bucketClave(origen.secreto);
        prevision.claves[tipo === 'bcrypt' ? 'hashCompatible' : tipo === 'anterior' ? 'texto' : 'restablecer']++;
      }
    }
    acceso.pendientes = acceso.elegibles;
    resumen.previsionAccesos = prevision;
    avisar('prevision_accesos', 'Vista previa de solo lectura: no se crearon ni enlazaron accesos. Los formatos de claves son una previsión; Auth puede rechazar una clave y exigir restablecerla.', acceso.elegibles);
    console.log(`  Vista previa: ${prevision.crear} identidades nuevas, ${prevision.enlazar} existentes por enlazar, ${acceso.conflictos} conflictos`);
    return;
  }
  const actualizarResumen = () => {
    acceso.pendientes = acceso.elegibles - acceso.creadas - acceso.enlazadas;
    resumen.auth = { creadas: acceso.creadas + acceso.enlazadas, fallidas: acceso.fallidas };
    resumen.estado = acceso.pendientes || acceso.fallidas || acceso.conflictos || (SOLO_ACCESOS && acceso.sinOrigen)
      ? 'parcial' : 'completada';
  };
  const inicio = Date.now();
  let intentadas = 0;
  const lotePendientes = pendientes.filter((c) => Number(c.id) > DESPUES_AUTH);
  console.log(`  Accesos elegibles: ${pendientes.length}; perfiles ya enlazados: ${acceso.existentes}`);
  for (const [indice, candidato] of lotePendientes.entries()) {
    // Reservar dos peticiones de 15 s (clave original y alternativa) y cierre.
    if (intentadas >= LIMITE_AUTH || Date.now() - inicio + 35_000 >= TIEMPO_AUTH_MS) {
      acceso.siguienteId = indice ? Number(lotePendientes[indice - 1].id) : DESPUES_AUTH;
      break;
    }
    intentadas++;
    let transaccion = false;
    try {
      await pool.query('BEGIN');
      transaccion = true;
      await pool.query("SET LOCAL statement_timeout = '15s'");
      // Protege el mismo perfil entre procesos/instancias. La conexión directa
      // conserva el bloqueo solo durante esta cuenta, también con pooler.
      const bloqueo = await pool.query('SELECT pg_try_advisory_xact_lock(736285, hashtext($1)) AS ok', [String(candidato.id)]);
      if (!bloqueo.rows[0].ok) {
        await pool.query('ROLLBACK');
        transaccion = false;
        continue;
      }
      const c = (await pool.query(`SELECT id, email, nombre, identificacion, auth_user_id, activo FROM usuarios WHERE id = $1 FOR UPDATE`, [candidato.id])).rows[0];
      if (!c || !c.activo || emailDe(c.email) !== emailDe(candidato.email)) throw conflictoAcceso();
      if (c.auth_user_id) {
        // Otro lote terminó esta cuenta desde que se tomó la instantánea.
        acceso.elegibles--;
        acceso.existentes++;
        await pool.query('COMMIT');
        transaccion = false;
        continue;
      }
      const cuenta = porEmail.get(emailDe(c.email));
      if (!cuenta || cuenta.conflicto || !mismaIdentidad(c.identificacion, cuenta.identificacion)) throw conflictoAcceso();
      let id = await idAuthPorEmail(c.email, c.id);
      let creada = false;
      let conservo = false;
      if (!id) {
        const respuesta = await crearAcceso(c, cuenta.secreto ?? secretoVacio());
        if (respuesta.error) {
          const duplicado = ['email_exists', 'user_already_exists'].includes(respuesta.error.code)
            || /already|registered|duplicate/i.test(respuesta.error.message);
          id = duplicado ? await idAuthPorEmail(c.email, c.id) : null;
          if (!id) throw new Error('No se pudo crear el acceso.');
        } else {
          // También detecta configuración Auth/Postgres de proyectos distintos
          // cuando se usan dominios propios y no se puede comparar el project ref.
          const idDestino = await idAuthPorEmail(c.email, c.id);
          if (!respuesta.data?.user?.id || idDestino !== respuesta.data.user.id) throw conflictoAcceso();
          id = idDestino;
          creada = true;
          conservo = respuesta.conservo;
        }
      }
      const enlace = await pool.query(`UPDATE usuarios SET auth_user_id = $1
        WHERE id = $2 AND auth_user_id IS NULL AND activo AND email = $3`, [id, c.id, c.email]);
      if (enlace.rowCount !== 1) throw conflictoAcceso();
      await pool.query('COMMIT');
      transaccion = false;
      if (creada) {
        acceso.creadas++;
        if (conservo) acceso.conservadas++;
        else acceso.restablecer++;
      } else acceso.enlazadas++;
    } catch (error) {
      if (transaccion) await pool.query('ROLLBACK').catch(() => {});
      if (error.code === 'CONFLICTO_ACCESO' || error.code === '23505') {
        acceso.elegibles--;
        acceso.conflictos++;
      } else acceso.fallidas++;
    }
    actualizarResumen();
    if (intentadas % 50 === 0) console.log(`  Accesos procesados: ${intentadas}/${pendientes.length}`);
  }
  actualizarResumen();
  if (acceso.conflictos) avisar('auth_conflicto', 'Perfiles con identidades o correos en conflicto requieren revisión; no se cambió su acceso.', acceso.conflictos);
  if (SOLO_ACCESOS && acceso.sinOrigen) avisar('auth_sin_origen', 'Perfiles sin acceso y sin coincidencia en el origen se conservaron; revise su procedencia.', acceso.sinOrigen);
  if (acceso.fallidas) avisar('auth_fallida', 'No se pudieron completar algunos accesos. Reintente el lote; si persiste, revise la configuración de Auth.', acceso.fallidas);
  if (acceso.pendientes) avisar('auth_pendiente', 'Quedan accesos elegibles pendientes. Continúe con otro lote.', acceso.pendientes);
  console.log(`  Auth: ${acceso.creadas} creadas, ${acceso.enlazadas} enlazadas, ${acceso.fallidas} fallos, ${acceso.pendientes} pendientes; ${acceso.conservadas} con su clave, ${acceso.restablecer} deben restablecerla`);
}

// ----------------------------------------------------------------------------
// PASO 4 — Reseñas
// ----------------------------------------------------------------------------

async function pasoResenas() {
  log('Reseñas');
  const fichas = await mysqlAll('tb_inquilinos_no_nacionales');
  if (!fichas) { console.log('  · no hay fichas'); return; }

  const idents = [...new Set(fichas.map(identFicha))];
  const personaMap = new Map((await pool.query(
    'SELECT id, identificacion FROM personas WHERE identificacion = ANY($1::text[])', [idents],
  )).rows.map((r) => [r.identificacion, r.id]));
  const legacyPersonas = new Map(((await mysqlAll('tb_persona')) ?? []).map((r) => [Number(r.camp_id_persona), r]));
  const legacyResenadores = new Map(((await mysqlAll('tb_resenador')) ?? []).map((r) => [Number(r.camp_id_resenador), r]));
  const autorMap = new Map();
  const claveAutor = (ficha) => Number(ficha.camp_fk_registrador)
    ? `registrador-${Number(ficha.camp_fk_registrador)}` : `ficha-${ficha.camp_id_inquilino}`;
  const usuarios = (await pool.query(`SELECT u.id, u.identificacion, p.identificacion AS persona_identificacion
    FROM usuarios u LEFT JOIN personas p ON p.id = u.persona_id`)).rows;
  const porIdent = new Map();
  for (const u of usuarios) {
    for (const ident of new Set([u.identificacion, u.persona_identificacion].filter(Boolean))) {
      if (!porIdent.has(ident)) porIdent.set(ident, []);
      porIdent.get(ident).push(u.id);
    }
  }
  const pendientes = new Map();
  for (const ficha of fichas) {
    const clave = claveAutor(ficha);
    if (autorMap.has(clave) || pendientes.has(clave)) continue;
    const registrador = Number(ficha.camp_fk_registrador);
    const identificaciones = [...new Set([
      texto(legacyPersonas.get(registrador)?.camp_identificacion),
      texto(legacyResenadores.get(registrador)?.camp_identificacion_resenador),
    ].filter(Boolean))];
    const cuentas = identificaciones.length === 1 ? porIdent.get(identificaciones[0]) : null;
    if (cuentas?.length === 1) autorMap.set(clave, cuentas[0]);
    else pendientes.set(clave, `autor-${clave}@legacy.laprotec`);
  }
  if (pendientes.size) {
    // No persona_id: placeholders cannot steal the 1:1 link of real accounts.
    const creados = (await pool.query(`INSERT INTO usuarios (email, nombre, rol, activo)
      SELECT email, 'Autor legacy sin acceso', 'propietario', false FROM unnest($1::text[]) AS email
      ON CONFLICT (email) DO UPDATE SET activo = false RETURNING id, email`, [[...pendientes.values()]])).rows;
    const porEmail = new Map(creados.map((u) => [u.email, u.id]));
    for (const [clave, email] of pendientes) autorMap.set(clave, porEmail.get(email));
    resumen.usuarios += pendientes.size;
    avisar('autor_placeholder', 'Se conservaron reseñas con autores sin cuenta inequívoca bajo perfiles legacy inactivos.', pendientes.size);
  }

  const siNo = (v) => {
    if (v === 0 || v === 1) return Boolean(v);
    if (v != null) avisar('booleano_desconocido', 'Valores distintos de 0/1 en recomienda o drogas se conservaron como desconocidos.');
    return null;
  };

  // Ship this additive migration with the worker so existing installations do
  // not need a schema reset or a separate rollout step. Dry-runs roll it back.
  await pool.query(await readFile(new URL('../db/importacion-legacy-resenas.sql', import.meta.url), 'utf8'));
  await pool.query("SET LOCAL laprotec.importacion_legacy = 'on'");

  const grupos = new Map();
  const originales = [];
  for (const ficha of fichas) {
    const personaId = personaMap.get(identFicha(ficha));
    const autorId = autorMap.get(claveAutor(ficha));
    if (!personaId || !autorId) throw new Error(`Ficha legacy #${ficha.camp_id_inquilino}: falta su persona o autor de destino.`);
    const par = `${autorId}:${personaId}`;
    const fechaOrigen = fecha(ficha.camp_fecha_registro, true);
    const instante = fechaOrigen == null ? NaN : Date.parse(fechaOrigen);
    const candidato = { ficha, personaId, autorId, par,
      fechaOrigen: Number.isFinite(instante) ? fechaOrigen : null,
      instante: Number.isFinite(instante) ? instante : -Infinity };
    const anterior = grupos.get(par);
    if (!anterior || candidato.instante > anterior.instante
      || (candidato.instante === anterior.instante && Number(ficha.camp_id_inquilino) > Number(anterior.ficha.camp_id_inquilino))) {
      grupos.set(par, candidato);
    }
    // Sort keys so a changed MySQL column order cannot create a new version.
    const datos = JSON.stringify(Object.fromEntries(Object.entries(ficha).sort(([a], [b]) => a.localeCompare(b))));
    originales.push({ id: Number(ficha.camp_id_inquilino), par, datos,
      huella: crypto.createHash('sha256').update(datos).digest('hex') });
  }
  resumen.fichas.leidas = fichas.length;
  resumen.fichas.consolidadas = fichas.length - grupos.size;
  if (resumen.fichas.consolidadas) avisar('resenas_consolidadas',
    'Fichas del mismo propietario y persona consolidadas en la más reciente; todos los originales se conservaron en el archivo privado.', resumen.fichas.consolidadas);

  // Serialize this short reconciliation phase with native review writes as
  // well as other imports. Preserve the global one-review-per-pair constraint.
  await pool.query("SET LOCAL lock_timeout = '10s'");
  await pool.query('LOCK TABLE public.resenas IN SHARE ROW EXCLUSIVE MODE');
  const existentes = (await pool.query(`SELECT id, autor_id, persona_id, fuente, id_fuente, creado_en
    FROM public.resenas WHERE autor_id = ANY($1::int[]) OR (fuente='legacy' AND id_fuente = ANY($2::int[]))`,
    [[...new Set([...grupos.values()].map((r) => r.autorId))], originales.map((r) => r.id)])).rows;
  const porPar = new Map(existentes.map((r) => [`${r.autor_id}:${r.persona_id}`, r]));
  const parPorFuente = new Map(originales.map((r) => [r.id, r.par]));
  for (const r of existentes) {
    if (r.fuente === 'legacy' && parPorFuente.has(r.id_fuente)
      && parPorFuente.get(r.id_fuente) !== `${r.autor_id}:${r.persona_id}`) {
      throw new Error(`La ficha legacy #${r.id_fuente} cambió de propietario o persona. Reconcilie esa identidad antes de reimportar; no se reasignaron reseñas existentes.`);
    }
  }
  const seleccionadas = [...grupos.values()].filter((r) => {
    const actual = porPar.get(r.par);
    if (!actual || actual.fuente === 'legacy') return true;
    resumen.fichas.conservadas++;
    return false;
  });
  if (resumen.fichas.conservadas) avisar('resenas_actuales_conservadas',
    'Se conservaron las reseñas existentes del registro actual; sus fichas legacy se guardaron únicamente en el archivo privado.', resumen.fichas.conservadas);

  let n = 0;
  const etqRows = [];
  const conductasRows = [];

  for (const { ficha: r, personaId, autorId, fechaOrigen, par } of seleccionadas) {

    const califId = ref(IDS.calificaciones, r.camp_fk_calificacion);

    // Legacy: 0 pendiente, 1 aceptada, 2 rechazada.
    const estadoNum = r.camp_estado == null || r.camp_estado === '' ? null : Number(r.camp_estado);
    const estado = estadoNum === 0
      ? 'borrador'
      : estadoNum === 2 || /ocult|inactiv|archiv|elimin|borrad|rechaz/i.test(r.camp_estadoText || '')
        ? 'oculta'
        : estadoNum === 1 ? 'publicada' : 'borrador';
    if (estadoNum == null || ![0, 1, 2].includes(estadoNum)) avisar('estado_desconocido', 'Reseñas sin estado conocido se conservaron como borradores.');
    const nota = (r.camp_estadoText || '').trim() || null;

    n += await upsert(
      `INSERT INTO resenas
         (persona_id, autor_id, tipo, calificacion_id, recomienda, drogas,
          dano_vivienda_id, proceso_judicial_id, tipo_contrato_id, tipo_alquiler_id,
          tiempo_alquiler_id, comentario, detalle_verificacion, estado, fuente, id_fuente, creado_en)
       VALUES ($1,$2,'inquilino',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'legacy',$14,COALESCE($15::timestamptz, now()))
       ON CONFLICT (autor_id, persona_id) DO UPDATE SET
         id_fuente = EXCLUDED.id_fuente,
         calificacion_id = EXCLUDED.calificacion_id,
         recomienda = EXCLUDED.recomienda,
         drogas = EXCLUDED.drogas,
         dano_vivienda_id = EXCLUDED.dano_vivienda_id,
         proceso_judicial_id = EXCLUDED.proceso_judicial_id,
         tipo_contrato_id = EXCLUDED.tipo_contrato_id,
         tipo_alquiler_id = EXCLUDED.tipo_alquiler_id,
         tiempo_alquiler_id = EXCLUDED.tiempo_alquiler_id,
         comentario = EXCLUDED.comentario,
         detalle_verificacion = EXCLUDED.detalle_verificacion,
         estado = EXCLUDED.estado,
         creado_en = EXCLUDED.creado_en`,
      [personaId, autorId, califId, siNo(r.camp_fk_recomienda_inquilino), siNo(r.camp_drogas),
       ref(IDS.danos, r.camp_fk_dano_vivienda), ref(IDS.procesos, r.camp_fk_proceso_judicial),
       ref(IDS.tipos_contrato, r.camp_fk_tipo_contrato), ref(IDS.tipos_alquiler, r.camp_fk_tipo_alquiler),
       ref(IDS.tiempos_alquiler, r.camp_fk_tiempo_alquiler),
       r.camp_comentario_adicional ?? null, nota, estado, r.camp_id_inquilino, fechaOrigen ?? porPar.get(par)?.creado_en ?? null],
      'reseña legacy', r.camp_id_inquilino,
    );

    const conductaId = ref(IDS.conductas, r.camp_fk_conducta);
    if (conductaId) conductasRows.push({ legacyId: Number(r.camp_id_inquilino), conductaId });
    for (const col of ['camp_fk_etiqueta_uno', 'camp_fk_etiqueta_dos', 'camp_fk_etiqueta_tres', 'camp_fk_etiqueta_cuatro']) {
      const v = ref(IDS.etiquetas, r[col]);
      if (v) etqRows.push({ legacyId: Number(r.camp_id_inquilino), etiquetaId: v });
    }
  }
  await guardarLote();
  resumen.resenas = n;
  console.log(`  reseñas: ${n}; fichas originales: ${fichas.length}; consolidadas: ${resumen.fichas.consolidadas}; actuales conservadas: ${resumen.fichas.conservadas}`);

  const canonicas = new Map((await pool.query(`SELECT id, autor_id, persona_id FROM public.resenas
    WHERE autor_id = ANY($1::int[])`, [[...new Set([...grupos.values()].map((r) => r.autorId))]])).rows
    .map((r) => [`${r.autor_id}:${r.persona_id}`, r.id]));
  for (const original of originales) {
    const resenaId = canonicas.get(original.par);
    if (!resenaId) throw new Error('No se pudo enlazar una ficha con su reseña de destino.');
    original.resenaId = resenaId;
    await upsert(`INSERT INTO privado.resenas_legacy_originales (id_fuente, huella, datos, resena_id)
      VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT (id_fuente, huella) DO NOTHING`,
    [original.id, original.huella, original.datos, resenaId], 'archivo de ficha legacy', `${original.id}:${original.huella}`);
  }
  await guardarLote();
  // Relink only the current snapshot (e.g. after a deleted review is imported
  // again). Older versions retain the pair they belonged to when archived.
  await pool.query(`UPDATE privado.resenas_legacy_originales a SET resena_id = x.resena
    FROM unnest($1::int[], $2::text[], $3::int[]) AS x(fuente, huella, resena)
    WHERE a.id_fuente = x.fuente AND a.huella = x.huella AND a.resena_id IS DISTINCT FROM x.resena`,
    [originales.map((r) => r.id), originales.map((r) => r.huella), originales.map((r) => r.resenaId)]);
  resumen.fichas.archivadas = originales.length;

  const fuentesSeleccionadas = seleccionadas.map((r) => Number(r.ficha.camp_id_inquilino));

  await pool.query(`DELETE FROM resena_etiquetas WHERE resena_id IN
    (SELECT id FROM resenas WHERE fuente = 'legacy' AND id_fuente = ANY($1::int[]))`,
    [fuentesSeleccionadas]);
  if (etqRows.length) {
    await pool.query(`INSERT INTO resena_etiquetas (resena_id, etiqueta_id)
      SELECT r.id, x.etiqueta FROM unnest($1::int[], $2::int[]) AS x(legacy, etiqueta)
      JOIN resenas r ON r.fuente = 'legacy' AND r.id_fuente = x.legacy ON CONFLICT DO NOTHING`,
      [etqRows.map((e) => e.legacyId), etqRows.map((e) => e.etiquetaId)]);
  }
  await pool.query(`DELETE FROM resena_conductas WHERE resena_id IN
    (SELECT id FROM resenas WHERE fuente = 'legacy' AND id_fuente = ANY($1::int[]))`, [fuentesSeleccionadas]);
  if (conductasRows.length) {
    await pool.query(`INSERT INTO resena_conductas (resena_id, conducta_id)
      SELECT r.id, x.conducta FROM unnest($1::int[], $2::int[]) AS x(legacy, conducta)
      JOIN resenas r ON r.fuente = 'legacy' AND r.id_fuente = x.legacy ON CONFLICT DO NOTHING`,
      [conductasRows.map((c) => c.legacyId), conductasRows.map((c) => c.conductaId)]);
  }

  {
    const q = await pool.query(`SELECT count(*)::int AS n FROM resenas`);
    console.log(`  TOTAL resenas en destino: ${q.rows[0].n}`);
  }
}

// ----------------------------------------------------------------------------
// Ejecución
// ----------------------------------------------------------------------------

console.log('=== Migración legacy MySQL → v2 Postgres ===');
console.log(`Fuente:  ${mysqlCfg.user}@${mysqlCfg.host}:${mysqlCfg.port}/${mysqlCfg.database}`);
console.log(`Destino: ${SOLO_ACCESOS && seco ? 'VISTA PREVIA (solo lectura, sin Auth API)' : seco ? 'SIMULACIÓN (ROLLBACK al terminar)' : 'Postgres vía DATABASE_URL'}`);
console.log(`Pasos:   ${SOLO_ACCESOS ? 'solo accesos de perfiles existentes' : PASOS.join(', ')}${CREAR_ACCOUNTS ? ' + crear-accounts' : ''}`);

let cuentasImportadas = [];
let confirmado = false;
let conectado = false;
try {
  await pool.connect();
  conectado = true;
  await pool.query(SOLO_ACCESOS && seco ? 'BEGIN READ ONLY' : 'BEGIN');
  const bloqueo = await pool.query("SELECT pg_try_advisory_xact_lock(736284, 1) AS ok");
  if (!bloqueo.rows[0].ok) throw new Error('Ya hay una importación en curso en la base de datos.');
  await pool.query("SET LOCAL statement_timeout = '60s'");
  await mysqlRows('SET time_zone = ?', [zonaLegacy]);
  if (SOLO_ACCESOS) {
    if (!(await mysqlTableExists('users')) && !(await mysqlTableExists('tb_login'))) {
      throw new Error('El origen no contiene las tablas de accesos users ni tb_login. Revise la base de datos seleccionada.');
    }
    cuentasImportadas = await cargarCuentasLegacy(true);
  } else {
    if (!(await mysqlTableExists('tb_inquilinos_no_nacionales'))) {
      throw new Error('El origen no contiene la tabla de fichas tb_inquilinos_no_nacionales. Revise la base de datos seleccionada.');
    }
    if (!(await mysqlTableExists('tb_persona'))) {
      avisar('sin_tb_persona', 'El origen no contiene tb_persona. Las personas se obtuvieron de las fichas y solicitantes disponibles; los accesos y autores sin identidad comprobable se conservaron como perfiles legacy inactivos.');
    }
    for (const tabla of Object.keys(COLUMNAS_ORIGEN)) await mysqlAll(tabla);
    if (PASOS.includes('lookups')) await pasoLookups();
    if (PASOS.includes('personas')) await pasoPersonas();
    if (PASOS.includes('usuarios')) await pasoUsuarios();
    if (PASOS.includes('resenas')) await pasoResenas();
  }
  resumen.personas = personasProcesadas.size;
  if (CREAR_ACCOUNTS) await pool.query('SELECT id, email FROM auth.users LIMIT 0');
  if (SOLO_ACCESOS && seco) await crearCuentasAuth(cuentasImportadas);
  await pool.query(seco ? 'ROLLBACK' : 'COMMIT');
  confirmado = !seco;
  if (confirmado) console.log(SOLO_ACCESOS ? 'Perfiles conservados. Completando accesos.' : 'Datos confirmados en Postgres.');
  // Auth es un servicio externo: se ejecuta después del COMMIT, es reintentable
  // y nunca se presenta un fallo suyo como una importación completa.
  if (CREAR_ACCOUNTS) await crearCuentasAuth(cuentasImportadas);
  if (resumen.estado === 'parcial') process.exitCode = 2;
  console.log('\n=== Resumen ===');
  console.log(JSON.stringify(resumen, null, 2));
} catch (error) {
  if (conectado && !confirmado) await pool.query('ROLLBACK').catch(() => {});
  if (confirmado) {
    resumen.estado = 'parcial';
    avisar('auth_interrumpida', SOLO_ACCESOS
      ? 'La creación de accesos quedó incompleta. Reintente el lote; los perfiles se conservaron.'
      : 'Los datos se guardaron, pero la creación de accesos quedó incompleta. Reintente la importación.');
    process.exitCode = 2;
    console.log('\n=== Resumen ===');
    console.log(JSON.stringify(resumen, null, 2));
  } else {
    console.error(`No se guardaron los datos de esta importación. ${error.message}`);
    process.exitCode = 1;
  }
} finally {
  for (const cuenta of cuentasImportadas) cuenta.secreto = null;
  await m.end();
  await pool.end();
}
