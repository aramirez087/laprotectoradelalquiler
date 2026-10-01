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
const db = new pg.Client({ ...configuracionPostgres(process.env.DATABASE_URL), connectionTimeoutMillis: 15_000, statement_timeout: 30_000 })
await db.connect()
try {
  const { rows: [padron] } = await db.query('SELECT version, fecha_padron::text, prefijos FROM public.padron_tse WHERE id = 1')
  if (!padron || !padronVigente(padron.fecha_padron) || !/^\d{4}-\d{2}-\d{2}-[a-f0-9]{16}$/.test(padron.version)) {
    throw new Error('Se requiere un padrón vigente y válido; no se modificó ningún registro.')
  }
  // Incluye cuentas y fichas nuevas, y ambas partes de las reseñas recientes.
  const { rows } = await db.query(`
    WITH recientes AS (SELECT persona_id, autor_id FROM public.resenas WHERE creado_en >= now() - interval '2 days')
    SELECT 'personas' AS tabla, id, identificacion, nombre, nombre2, apellido1, apellido2,
      concat_ws(' ', nombre, nullif(nombre2, ''), apellido1, nullif(apellido2, '')) AS nombre_completo
    FROM public.personas WHERE creado_en >= now() - interval '2 days' OR id IN (SELECT persona_id FROM recientes)
    UNION ALL
    SELECT 'usuarios', id, identificacion, nombre, NULL, NULL, NULL, nombre
    FROM public.usuarios WHERE creado_en >= now() - interval '2 days' OR id IN (SELECT autor_id FROM recientes)
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
    resultados.push({ cedula, persona: buscarEnFragmento(lineas, cedula) })
  }
  const porCedula = new Map(resultados.map(r => [r.cedula, r.persona]))
  const correcciones = rows.flatMap(row => {
    const persona = porCedula.get(cedulaNacional(row.identificacion))
    if (!persona) return []
    const cambiado = row.tabla === 'usuarios' ? row.nombre !== persona.nombreCompleto
      : row.nombre !== persona.nombre || (row.nombre2 ?? '') !== persona.nombre2
        || row.apellido1 !== persona.apellido1 || (row.apellido2 ?? '') !== persona.apellido2
    return cambiado ? [{ row, persona }] : []
  })
  let nombresActualizados = 0
  if (args.includes('--aplicar')) {
    await db.query('BEGIN')
    try {
      await db.query(`SELECT public.guardar_verificacion_cedula(r.cedula, $2::date, r.nombre)
        FROM jsonb_to_recordset($1::jsonb) AS r(cedula text, nombre text)`,
        [JSON.stringify(resultados.map(r => ({ cedula: r.cedula, nombre: r.persona?.nombreCompleto ?? null }))), padron.fecha_padron])
      // No pisar correcciones concurrentes ni cambiar identidad, rol o moderación.
      // Dos UPDATE por lote; no un viaje de red por cada registro.
      const usuarios = correcciones.filter(c => c.row.tabla === 'usuarios').map(({ row, persona }) => ({
        id: row.id, identificacion: row.identificacion, anterior: row.nombre, nombre: persona.nombreCompleto,
      }))
      const usuariosActualizados = await db.query(`UPDATE public.usuarios u SET nombre = c.nombre, actualizado_en = now()
        FROM jsonb_to_recordset($1::jsonb) AS c(id integer, identificacion text, anterior text, nombre text)
        WHERE u.id = c.id AND u.identificacion = c.identificacion AND u.nombre = c.anterior`, [JSON.stringify(usuarios)])
      const personas = correcciones.filter(c => c.row.tabla === 'personas').map(({ row, persona }) => ({
        id: row.id, identificacion: row.identificacion, anterior: row.nombre, anterior2: row.nombre2,
        apellido_anterior1: row.apellido1, apellido_anterior2: row.apellido2,
        nombre: persona.nombre, nombre2: persona.nombre2 || null, apellido1: persona.apellido1, apellido2: persona.apellido2 || null,
      }))
      const personasActualizadas = await db.query(`UPDATE public.personas p SET nombre = c.nombre, nombre2 = c.nombre2,
        apellido1 = c.apellido1, apellido2 = c.apellido2, actualizado_en = now()
        FROM jsonb_to_recordset($1::jsonb) AS c(id integer, identificacion text, anterior text, anterior2 text,
          apellido_anterior1 text, apellido_anterior2 text, nombre text, nombre2 text, apellido1 text, apellido2 text)
        WHERE p.id = c.id AND p.identificacion = c.identificacion AND p.nombre = c.anterior
          AND p.nombre2 IS NOT DISTINCT FROM c.anterior2 AND p.apellido1 = c.apellido_anterior1
          AND p.apellido2 IS NOT DISTINCT FROM c.apellido_anterior2`, [JSON.stringify(personas)])
      nombresActualizados = usuariosActualizados.rowCount + personasActualizadas.rowCount
      const { rows: [guardados] } = await db.query(`SELECT count(*)::int AS total FROM public.verificaciones_cedula WHERE identificacion = ANY($1::text[])`, [cedulas])
      if (guardados.total !== resultados.length) throw new Error('No se guardaron todos los resultados.')
      await db.query('COMMIT')
    } catch (error) { await db.query('ROLLBACK'); throw error }
  }
  // Solo totales; nunca cédulas ni nombres en logs.
  console.log(JSON.stringify({ modo: args.includes('--aplicar') ? 'guardado' : 'simulacion', ventana: 'últimas 48 horas',
    fechaPadron: padron.fecha_padron, documentos: rows.length, cedulas: cedulas.length,
    encontradas: resultados.filter(r => r.persona !== null).length, noEncontradas: resultados.filter(r => r.persona === null).length,
    nombresPorCorregir: correcciones.length, nombresActualizados,
    descargas }, null, 2))
} finally { await db.end() }
