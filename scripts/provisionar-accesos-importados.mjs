// Existing profiles only. Default: read-only preview; --aplicar: bounded batch.
// No MySQL, password import, email sending, role changes or existing Auth linking.
// Examples:
//   node scripts/provisionar-accesos-importados.mjs
//   node scripts/provisionar-accesos-importados.mjs --aplicar --limite=50 --tiempo=120
//   node scripts/provisionar-accesos-importados.mjs --aplicar --despues=123
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import * as z from 'zod';
import { configuracionPostgres } from './postgres-config.mjs';

export function opcionesProvision(args) {
  const options = { aplicar: false, limite: 50, tiempo: 120, despues: 0 };
  const seen = new Set();
  for (const arg of args) {
    const [name, value, extra] = arg.split('=');
    if (seen.has(name) || extra !== undefined) throw new Error('Opciones de provisión inválidas.');
    seen.add(name);
    if (name === '--aplicar' && value === undefined) options.aplicar = true;
    else {
      const limit = { '--limite': [1, 200], '--tiempo': [1, 600], '--despues': [0, 2147483647] }[name];
      if (!limit || !/^\d+$/.test(value ?? '') || Number(value) < limit[0] || Number(value) > limit[1]) {
        throw new Error('Opciones de provisión inválidas.');
      }
      options[name.slice(2)] = Number(value);
    }
  }
  if (!options.aplicar && args.length) throw new Error('La vista previa no admite opciones de aplicación.');
  return options;
}

export function verificarDestino(databaseUrl, authUrl, env = process.env) {
  let db, auth;
  try { db = new URL(databaseUrl); auth = new URL(authUrl); }
  catch { throw new Error('No se pudo verificar el proyecto de destino.'); }
  const parameters = Object.fromEntries(db.searchParams);
  const host = (parameters.host || db.hostname).toLowerCase().replace(/^\[|\]$/g, '');
  const user = parameters.user ?? decodeURIComponent(db.username);
  const local = h => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(h);
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || auth.username || auth.password
    || auth.search || auth.hash || auth.pathname !== '/') throw new Error('No se pudo verificar el proyecto de destino.');
  if (env.DATABASE_SSL === 'false' && local(host) && local(auth.hostname) && auth.protocol === 'http:') return 'local';
  const refDb = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(host)?.[1]
    ?? (host.endsWith('.pooler.supabase.com') ? /^postgres\.([a-z0-9]+)$/.exec(user)?.[1] : null);
  const refAuth = /^([a-z0-9]+)\.supabase\.co$/.exec(auth.hostname)?.[1];
  if (auth.protocol !== 'https:' || auth.port || !refDb || !refAuth || refDb !== refAuth) {
    throw new Error('Postgres y Auth deben identificar el mismo proyecto de Supabase.');
  }
  return refDb;
}

const emailDe = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
function documentoDe(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const digits = text.replace(/\D/g, '');
  return /^[\d -]+$/.test(text) && digits.length >= 6 ? digits : text;
}
function correoReal(email) {
  const domain = email.split('@')[1] ?? '';
  return email.length <= 254 && z.email().safeParse(email).success
    && !/(?:^|\.)(?:invalid|test|localhost|example)$/.test(domain)
    && !['legacy.laprotec', 'example.com', 'example.net', 'example.org'].includes(domain);
}

/** Both modes use the same mutually exclusive exclusions. No personal data in counts. */
export function clasificarPerfiles(perfiles, auth = [], invitaciones = []) {
  const correos = new Map(), documentos = new Map();
  for (const profile of perfiles) {
    const email = emailDe(profile.email), document = documentoDe(profile.identificacion);
    correos.set(email, (correos.get(email) ?? 0) + 1);
    // An inactive, unlinked historical duplicate has no access to compete
    // with the active profile. Linked identities still reserve the document.
    if (document && (profile.activo || profile.auth_user_id)) {
      documentos.set(document, (documentos.get(document) ?? 0) + 1);
    }
  }
  const existentes = new Set(auth.map(row => emailDe(row.email)));
  const pendientes = new Set(invitaciones.map(row => emailDe(row.email)));
  const conteos = { total: perfiles.length, existentes: 0, inactivas: 0, administradores: 0,
    sinCorreo: 0, conflictos: 0, authExistente: 0, invitacionesPendientes: 0, elegibles: 0 };
  const elegibles = [];
  for (const profile of perfiles) {
    const email = emailDe(profile.email), document = documentoDe(profile.identificacion);
    let group;
    if (profile.auth_user_id) group = 'existentes';
    else if (!profile.activo) group = 'inactivas';
    else if (profile.rol === 'admin') group = 'administradores';
    else if (!correoReal(email)) group = 'sinCorreo';
    else if (!['propietario', 'agencia', 'inquilino'].includes(profile.rol)
      || correos.get(email) > 1 || (document && documentos.get(document) > 1)) group = 'conflictos';
    else if (existentes.has(email)) group = 'authExistente';
    else if (pendientes.has(email)) group = 'invitacionesPendientes';
    else { group = 'elegibles'; elegibles.push(profile); }
    conteos[group]++;
  }
  return { conteos, elegibles };
}

async function leerPerfiles(db) {
  const perfiles = (await db.query('SELECT id,email,identificacion,auth_user_id,activo,rol FROM public.usuarios ORDER BY id')).rows;
  const auth = (await db.query('SELECT email FROM auth.users')).rows;
  const tables = (await db.query("SELECT to_regclass('public.invitaciones_admin') IS NOT NULL AS invitaciones, to_regclass('privado.invitaciones_admin_emisiones') IS NOT NULL AS emisiones")).rows[0];
  const invitaciones = [];
  if (tables.invitaciones) invitaciones.push(...(await db.query('SELECT email FROM public.invitaciones_admin WHERE aceptada_en IS NULL AND revocada_en IS NULL AND vence_en > clock_timestamp()')).rows);
  if (tables.emisiones) invitaciones.push(...(await db.query('SELECT email FROM privado.invitaciones_admin_emisiones WHERE vence_en > clock_timestamp()')).rows);
  return clasificarPerfiles(perfiles, auth, invitaciones);
}

export async function provisionar(db, options, createAuth) {
  const resumen = { modo: options.aplicar ? 'aplicar' : 'vista_previa', estado: 'completada',
    lote: options.aplicar ? randomUUID() : null, conteos: null,
    intentadas: 0, creadas: 0, omitidas: 0, fallidas: 0, requierenRevision: 0, siguienteId: 0 };
  await db.query('BEGIN READ ONLY');
  let snapshot;
  try {
    await db.query("SET LOCAL statement_timeout = '15s'");
    snapshot = await leerPerfiles(db);
  } finally { await db.query('ROLLBACK'); }
  resumen.conteos = snapshot.conteos;
  if (!options.aplicar) return resumen;

  // Constructing an Auth client is unnecessary in preview mode.
  const auth = await createAuth();
  const candidates = snapshot.elegibles.filter(row => row.id > options.despues);
  const deadline = Date.now() + options.tiempo * 1000;
  let lastId = options.despues;
  for (const candidate of candidates) {
    if (resumen.intentadas >= options.limite || Date.now() + 25_000 >= deadline) {
      resumen.estado = 'parcial'; resumen.siguienteId = lastId; break;
    }
    resumen.intentadas++;
    lastId = candidate.id;
    let contactedAuth = false;
    try {
      await db.query('BEGIN');
      await db.query("SET LOCAL statement_timeout = '10s'; SET LOCAL lock_timeout = '2s'");
      const locks = (await db.query("SELECT pg_try_advisory_xact_lock(hashtextextended('administracion_usuarios',0)) AND pg_try_advisory_xact_lock(736285,hashtext($1)) AS ok", [String(candidate.id)])).rows[0];
      if (!locks.ok) {
        await db.query('ROLLBACK'); resumen.omitidas++; resumen.estado = 'parcial'; continue;
      }
      const target = (await db.query('SELECT id FROM public.usuarios WHERE id=$1 FOR UPDATE', [candidate.id])).rows[0];
      const current = target ? (await leerPerfiles(db)).elegibles.find(row => row.id === candidate.id) : null;
      if (!current || emailDe(current.email) !== emailDe(candidate.email)) {
        await db.query('ROLLBACK'); resumen.omitidas++; continue;
      }
      const email = emailDe(current.email);
      contactedAuth = true;
      const response = await auth.auth.admin.createUser({ email, password: `aA1!${randomBytes(48).toString('base64url')}`,
        email_confirm: true, app_metadata: { provision_acceso: { lote: resumen.lote, usuario_id: current.id } } });
      if (response.error || !response.data?.user?.id) throw new Error('Auth no confirmó la creación.');
      const identity = (await db.query('SELECT id,raw_app_meta_data,email_confirmed_at FROM auth.users WHERE lower(btrim(email))=$1', [email])).rows;
      if (identity.length !== 1 || identity[0].id !== response.data.user.id || !identity[0].email_confirmed_at
        || identity[0].raw_app_meta_data?.provision_acceso?.lote !== resumen.lote
        || identity[0].raw_app_meta_data?.provision_acceso?.usuario_id !== current.id) {
        throw new Error('No se pudo confirmar la identidad creada en el destino.');
      }
      const updated = await db.query('UPDATE public.usuarios SET auth_user_id=$1 WHERE id=$2 AND auth_user_id IS NULL AND activo AND rol=$3 AND email=$4',
        [identity[0].id, current.id, current.rol, current.email]);
      if (updated.rowCount !== 1) throw new Error('No se pudo enlazar la identidad creada.');
      await db.query('COMMIT');
      resumen.creadas++;
    } catch {
      await db.query('ROLLBACK').catch(() => {});
      resumen.fallidas++;
      // Auth is external to the transaction. A timeout or failed COMMIT can be
      // ambiguous: never retry/delete/link by email. Preserve the opaque batch
      // marker for an operator to reconcile this exact attempt, then stop.
      if (contactedAuth) resumen.requierenRevision++;
      resumen.estado = contactedAuth ? 'requiere_revision' : 'parcial';
      resumen.siguienteId = 0;
      break;
    }
  }
  return resumen;
}

async function main() {
  const options = opcionesProvision(process.argv.slice(2));
  for (const file of ['.env.local', '.env']) {
    try { process.loadEnvFile(new URL(`../${file}`, import.meta.url)); } catch { /* optional */ }
  }
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error('Falta la conexión Postgres.');
  const authUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (options.aplicar) {
    if (!key || !authUrl) throw new Error('Falta la configuración de Supabase Auth.');
    verificarDestino(databaseUrl, authUrl);
  }
  const db = new pg.Client({ ...configuracionPostgres(databaseUrl), connectionTimeoutMillis: 15_000 });
  try {
    await db.connect();
    const summary = await provisionar(db, options, async () => {
      const { createClient } = await import('@supabase/supabase-js');
      return createClient(authUrl, key, { auth: { autoRefreshToken: false, persistSession: false }, global: {
        fetch: (url, init = {}) => fetch(url, { ...init,
          signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) }),
      } });
    });
    console.log(JSON.stringify(summary));
    if (summary.estado !== 'completada') process.exitCode = 2;
  } finally { await db.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Database/Auth errors may embed connection strings, email or SQL values.
    console.error(JSON.stringify({ estado: 'error', mensaje: 'No se pudo completar la provisión. Revise los argumentos, el proyecto de destino y los permisos.' }));
    process.exitCode = 1;
  });
}
