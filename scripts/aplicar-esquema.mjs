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

// Carga .env.local (convención Next.js) y, si existe, .env; no sobreescribe lo ya definido
for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(new URL(`../${f}`, import.meta.url)); } catch { /* opcional */ }
}

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}

const soloSchema = process.argv.includes('--solo-schema');
const soloInvitaciones = process.argv.includes('--solo-invitaciones-admin');
const soloAdminResenas = process.argv.includes('--solo-admin-resenas');
const dir = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool(configuracionPostgres(process.env.DATABASE_URL));

try {
  if (soloInvitaciones) {
    await pool.query(readFileSync(path.join(dir, '..', 'db', 'invitaciones-admin.sql'), 'utf8'));
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
