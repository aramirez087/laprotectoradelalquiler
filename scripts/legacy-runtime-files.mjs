import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// A spawned Node process cannot load dependencies bundled into Next chunks.
// Include its installed dependency trees, including nested package versions.
export function archivosRuntimeLegacy(root = process.cwd()) {
  const resolver = createRequire(path.join(root, 'package.json'));
  const carpetas = new Set();
  function visitar(nombre, requireFrom) {
    let carpeta = path.dirname(requireFrom.resolve(nombre));
    let manifiesto;
    while (true) {
      const archivo = path.join(carpeta, 'package.json');
      if (existsSync(archivo)) {
        const candidato = JSON.parse(readFileSync(archivo, 'utf8'));
        if (candidato.name === nombre) { manifiesto = candidato; break; }
      }
      const padre = path.dirname(carpeta);
      if (padre === carpeta) throw new Error(`No se encontró el paquete runtime ${nombre}.`);
      carpeta = padre;
    }
    if (carpetas.has(carpeta)) return;
    carpetas.add(carpeta);
    const desdePaquete = createRequire(path.join(carpeta, 'package.json'));
    for (const dependencia of Object.keys(manifiesto.dependencies ?? {})) visitar(dependencia, desdePaquete);
    for (const dependencia of Object.keys(manifiesto.optionalDependencies ?? {})) {
      try { desdePaquete.resolve(dependencia); } catch { continue; }
      visitar(dependencia, desdePaquete);
    }
  }
  for (const nombre of ['mysql2', 'pg', '@supabase/supabase-js']) visitar(nombre, resolver);
  return [...carpetas].map((carpeta) => `./${path.relative(root, carpeta).split(path.sep).join('/')}/**/*`);
}
