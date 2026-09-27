// Aplica schema.sql y (opcionalmente) db/seeds.sql al Postgres destino.
// Uso:
//   node scripts/aplicar-esquema.mjs            # schema + seeds
//   node scripts/aplicar-esquema.mjs --solo-schema
// Requiere DATABASE_URL (conexión directa de Supabase: .../postgres?port=5432&sslmode=require)

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// Carga .env.local (convención Next.js) y, si existe, .env; no sobreescribe lo ya definido
for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(new URL(`../${f}`, import.meta.url)); } catch { /* opcional */ }
}

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}

const soloSchema = process.argv.includes('--solo-schema');
const dir = path.dirname(fileURLToPath(import.meta.url));

// Supabase/pooler usa certificado autofirmado: ciframos sin validar la cadena.
// (El dashboard permite descargar la CA oficial para validación estricta.)
function sslConfig() {
  if (process.env.DATABASE_SSL === 'false') return undefined;
  if ((process.env.DATABASE_URL ?? '').includes('supabase.co')) return { rejectUnauthorized: false };
  return undefined;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig() });

try {
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
} finally {
  await pool.end();
}
