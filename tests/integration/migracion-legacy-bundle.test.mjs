import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const exec = promisify(execFile);
test('the production trace can run the import worker outside the workspace', async (t) => {
  const root = process.cwd();
  const manifest = path.join(root, '.next/server/app/admin/migracion/page.js.nft.json');
  const trace = JSON.parse(await readFile(manifest, 'utf8'));
  const isolated = await mkdtemp(path.join(os.tmpdir(), 'legacy-bundle-'));
  t.after(() => rm(isolated, { recursive: true, force: true }));
  for (const file of trace.files) {
    const source = path.resolve(path.dirname(manifest), file);
    const relative = path.relative(root, source);
    // Never copy .env files or rely on Next's bundled runtime chunks.
    if (!relative.startsWith('node_modules/') && !relative.startsWith('scripts/')) continue;
    const destination = path.join(isolated, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
  const worker = await exec(process.execPath, ['scripts/migrar-legacy.mjs', '--probar-claves'], { cwd: isolated, env: {} });
  assert.match(worker.stdout, /clasificarSecreto ok/);
  await exec(process.execPath, ['--input-type=module', '--eval', "await import('@supabase/supabase-js'); await import('mysql2/promise'); await import('pg');"], { cwd: isolated, env: {} });
});
