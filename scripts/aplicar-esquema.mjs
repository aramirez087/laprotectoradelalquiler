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
  '--solo-busqueda', '--solo-activacion', '--solo-moderacion-automatica', '--solo-dos-factores',
  '--solo-resultados-cedulas', '--solo-padron-tse', '--solo-schema', '--solo-invitaciones-admin', '--solo-admin-resenas',
  '--solo-admin-usuarios', '--solo-acceso-consultas', '--solo-seguridad-supabase', '--solo-correcciones-resenas',
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

// Access/session migrations replace the same RPCs. Commit them together so no
// request can observe an older, temporarily weaker definition between files.
async function aplicarMigracionesJuntas(archivos) {
  const sql = archivos.map((archivo) => readFileSync(path.join(dir, '..', 'db', archivo), 'utf8')
    .replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '')).join('\n');
  await pool.query(`BEGIN;\n${sql}\nCOMMIT;`);
}

try {
  if (argumentos.includes('--solo-dos-factores')) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'dos-factores.sql'), 'utf8'));
    console.log('✓ Verificación opcional en dos pasos preparada; los datos se conservan.');
  } else if (argumentos.includes('--solo-moderacion-automatica')) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'moderacion-automatica.sql'), 'utf8'));
    console.log('✓ Moderación automática y evidencia privada preparadas; los datos se conservan.');
  } else if (argumentos.includes('--solo-busqueda')) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'busqueda-relevante.sql'), 'utf8'));
    console.log('✓ Búsqueda relevante y resultados preparados; los datos se conservan.');
  } else if (argumentos.includes('--solo-activacion')) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'activacion.sql'), 'utf8'));
    console.log('✓ Borradores, activación y avisos preparados; los datos se conservan.');
  } else if (argumentos.includes('--solo-correcciones-resenas')) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'administrar-resenas.sql'), 'utf8'));
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'correcciones-resenas.sql'), 'utf8'));
    console.log('✓ Correcciones e historial de reseñas preparados; los datos se conservan.');
  } else if (argumentos.includes('--solo-resultados-cedulas')) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'resultados-cedulas-tse.sql'), 'utf8'));
    console.log('✓ Resultados de cédulas preparados; los datos se conservan.');
  } else if (argumentos.includes('--solo-padron-tse')) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'verificacion-cedulas-tse.sql'), 'utf8'));
    console.log('✓ Verificación de cédulas TSE preparada; los datos se conservan.');
  } else if (argumentos.includes('--solo-seguridad-supabase')) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'seguridad-supabase.sql'), 'utf8'));
    console.log('✓ Seguridad de Supabase actualizada; los datos se conservan.');
  } else if (soloAdminUsuarios) {
    await aplicarMigracionesJuntas(['administrar-usuarios.sql', 'invitaciones-admin.sql', 'sesiones-admin.sql']);
    console.log('✓ Administración de usuarios, invitaciones y sesiones actualizada; los datos se conservan.');
  } else if (soloAccesoConsultas) {
    await aplicarMigracionesJuntas(['resenas-unicas.sql', 'acceso-temporal-consultas.sql', 'sesiones-admin.sql']);
    console.log('✓ Acceso temporal a consultas actualizado; los datos se conservan.');
  } else if (soloInvitaciones) {
    await aplicarMigracionesJuntas(['administrar-usuarios.sql', 'invitaciones-admin.sql', 'sesiones-admin.sql']);
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
