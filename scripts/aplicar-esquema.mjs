// Aplica schema.sql y (opcionalmente) db/seeds.sql al Postgres destino.
// Uso:
//   node scripts/aplicar-esquema.mjs            # schema + seeds
//   node scripts/aplicar-esquema.mjs --solo-schema
// Requiere DATABASE_URL. La CA de Supabase se incluye y se verifica el servidor.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { configuracionPostgres } from './postgres-config.mjs';

// Validate before reading credentials or creating a connection. A misspelled
// additive migration flag must never fall through to the full schema reset.
const argumentos = process.argv.slice(2);
const opciones = new Set([
  '--solo-padron-tse', '--solo-schema', '--solo-invitaciones-admin', '--solo-admin-resenas',
  '--solo-admin-usuarios', '--solo-acceso-consultas', '--solo-seguridad-supabase',
]);
const desconocidos = argumentos.filter((arg) => !opciones.has(arg));
if (desconocidos.length) {
  console.error(`Opciones desconocidas: ${desconocidos.join(', ')}. Use una sola opción válida: ${[...opciones].join(', ')}.`);
  process.exit(1);
}
if (argumentos.length > 1) {
  console.error('Las opciones de migración son excluyentes. Ejecute una sola opción por comando.');
  process.exit(1);
}

// Carga .env.local (convención Next.js) y, si existe, .env; no sobreescribe lo ya definido
for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(new URL(`../${f}`, import.meta.url)); } catch { /* opcional */ }
}

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}

const soloSchema = argumentos.includes('--solo-schema');
const soloInvitaciones = argumentos.includes('--solo-invitaciones-admin');
const soloAdminResenas = argumentos.includes('--solo-admin-resenas');
const soloAdminUsuarios = argumentos.includes('--solo-admin-usuarios');
const soloAccesoConsultas = argumentos.includes('--solo-acceso-consultas');
const dir = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool(configuracionPostgres(process.env.DATABASE_URL));

try {
  if (argumentos.includes('--solo-padron-tse')) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'verificacion-cedulas-tse.sql'), 'utf8'));
    console.log('✓ Verificación de cédulas TSE preparada; los datos se conservan.');
  } else if (argumentos.includes('--solo-seguridad-supabase')) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'seguridad-supabase.sql'), 'utf8'));
    console.log('✓ Seguridad de Supabase actualizada; los datos se conservan.');
  } else if (soloAdminUsuarios) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'administrar-usuarios.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'invitaciones-admin.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'sesiones-admin.sql'), 'utf8'));
    console.log('✓ Administración de usuarios, invitaciones y sesiones actualizada; los datos se conservan.');
  } else if (soloAccesoConsultas) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'resenas-unicas.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'acceso-temporal-consultas.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'sesiones-admin.sql'), 'utf8'));
    console.log('✓ Acceso temporal a consultas actualizado; los datos se conservan.');
  } else if (soloInvitaciones) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'administrar-usuarios.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'invitaciones-admin.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'sesiones-admin.sql'), 'utf8'));
    console.log('✓ Invitaciones de administración actualizadas; los datos se conservan.');
  } else if (soloAdminResenas) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'administrar-resenas.sql'), 'utf8'));
    console.log('✓ Funciones de administración de reseñas actualizadas; los datos se conservan.');
  } else {
    console.log('▸ Aplicando schema.sql ...');
    const schema = readFileSync(path.join(dir, '..', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('  ✓ schema ok');

    if (!soloSchema) {
      console.log('▸ Aplicando db/seeds.sql ...');
      const seeds = readFileSync(path.join(dir, '..', 'db', 'seeds.sql'), 'utf8');
      await pool.query(seeds);
      console.log('  ✓ seeds ok');
    }
  }
} finally {
  await pool.end();
}
