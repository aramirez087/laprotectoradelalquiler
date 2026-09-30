// Backfill explícito; nunca se ejecuta durante la carga del dashboard.
// node --experimental-strip-types scripts/revalidar-cedulas-recientes.mjs [--aplicar]
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { gunzipSync } from 'node:zlib'
import { buscarEnFragmento, cedulaNacional, padronVigente, PADRON_BUCKET } from '../lib/cedula.ts'
import { configuracionPostgres } from './postgres-config.mjs'

const args = process.argv.slice(2)
if (args.some(arg => arg !== '--aplicar') || args.length > 1) throw new Error('Use sin argumentos para revisar, o --aplicar para guardar.')
for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(new URL(`../${f}`, import.meta.url)) } catch { /* opcional */ }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key || !process.env.DATABASE_URL) throw new Error('Falta la configuración de servicio.')
const storage = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(30_000) }) },
}).storage.from(PADRON_BUCKET)
const db = new pg.Client(configuracionPostgres(process.env.DATABASE_URL))
await db.connect()
try {
  const { rows: [padron] } = await db.query('SELECT version, fecha_padron::text, prefijos FROM public.padron_tse WHERE id = 1')
  if (!padron || !padronVigente(padron.fecha_padron) || !/^\d{4}-\d{2}-\d{2}-[a-f0-9]{16}$/.test(padron.version)) {
    throw new Error('Se requiere un padrón vigente y válido; no se modificó ningún registro.')
  }
  // Incluye cuentas y fichas nuevas, y ambas partes de las reseñas recientes.
  const { rows } = await db.query(`
    WITH recientes AS (SELECT persona_id, autor_id FROM public.resenas WHERE creado_en >= now() - interval '2 days')
    SELECT identificacion FROM public.personas WHERE creado_en >= now() - interval '2 days' OR id IN (SELECT persona_id FROM recientes)
    UNION
    SELECT identificacion FROM public.usuarios WHERE creado_en >= now() - interval '2 days' OR id IN (SELECT autor_id FROM recientes)
  `)
  const cedulas = [...new Set(rows.map(row => cedulaNacional(row.identificacion)).filter(Boolean))].sort()
  const resultados = []
  let ultimoPrefijo, lineas = [], descargas = 0
  for (const cedula of cedulas) {
    const prefijo = cedula.slice(0, 3)
    if (prefijo !== ultimoPrefijo) {
      lineas = []
      if (padron.prefijos.includes(prefijo)) {
        const { data, error } = await storage.download(`${padron.version}/${prefijo}.txt.gz`)
        if (error || !data) throw new Error('Falló la descarga; no se modificó ningún registro.')
        descargas++
        lineas = gunzipSync(Buffer.from(await data.arrayBuffer()), { maxOutputLength: 8 * 1024 * 1024 }).toString('utf8').split('\n')
        if (lineas.at(-1) === '') lineas.pop()
        let anterior = ''
        for (const linea of lineas) {
          const campos = linea.split('\t')
          if (campos.length !== 4 || !cedulaNacional(campos[0]) || !campos[0].startsWith(prefijo)
            || campos[0] <= anterior || !campos[1] || !campos[2]) throw new Error('Fragmento inválido; no se modificó ningún registro.')
          anterior = campos[0]
        }
      }
      ultimoPrefijo = prefijo
    }
    resultados.push({ cedula, nombre: buscarEnFragmento(lineas, cedula)?.nombreCompleto ?? null })
  }
  if (args.includes('--aplicar')) {
    await db.query('BEGIN')
    try {
      for (const resultado of resultados) {
        await db.query('SELECT public.guardar_verificacion_cedula($1, $2, $3)', [resultado.cedula, padron.fecha_padron, resultado.nombre])
      }
      const { rows: [guardados] } = await db.query(`SELECT count(*)::int AS total FROM public.verificaciones_cedula WHERE identificacion = ANY($1::text[])`, [cedulas])
      if (guardados.total !== resultados.length) throw new Error('No se guardaron todos los resultados.')
      await db.query('COMMIT')
    } catch (error) { await db.query('ROLLBACK'); throw error }
  }
  // Solo totales; nunca cédulas ni nombres en logs.
  console.log(JSON.stringify({ modo: args.includes('--aplicar') ? 'guardado' : 'simulacion', ventana: 'últimas 48 horas',
    fechaPadron: padron.fecha_padron, documentos: rows.length, cedulas: cedulas.length,
    encontradas: resultados.filter(r => r.nombre !== null).length, noEncontradas: resultados.filter(r => r.nombre === null).length,
    descargas }, null, 2))
} finally { await db.end() }
