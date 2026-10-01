import { readFileSync } from 'node:fs'
import pg from 'pg'
import { configuracionPostgres } from './postgres-config.mjs'

// Preview first. Unknown options must fail before reading credentials.
const args=process.argv.slice(2)
if(args.length>1 || args.some(arg=>arg!=='--aplicar')) {
  console.error('Use sin opciones para revisar o --aplicar para configurar el scheduler.');process.exit(1)
}
for(const file of ['.env.local','.env']) {try {process.loadEnvFile(new URL(`../${file}`,import.meta.url))} catch { /* optional */ }}
const destino=process.env.DATABASE_URL || process.env.POSTGRES_URL
if(!destino) {console.error('Falta DATABASE_URL o POSTGRES_URL.');process.exit(1)}
const db=new pg.Client({...configuracionPostgres(destino),connectionTimeoutMillis:10000,statement_timeout:30000})
try {
  await db.connect()
  const prerequisites=(await db.query(`SELECT to_regclass('privado.avisos_moderacion') IS NOT NULL AS migracion,
    to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL AS cron,
    to_regprocedure('net.http_get(text,jsonb,jsonb,integer)') IS NOT NULL AS red,
    to_regclass('vault.decrypted_secrets') IS NOT NULL AS vault`)).rows[0]
  console.log(JSON.stringify(prerequisites))
  if(!Object.values(prerequisites).every(Boolean)) {
    throw Error('Aplique db:activacion y habilite pg_cron, pg_net y Vault en la integración Supabase antes de continuar.')
  }
  const existing=(await db.query("SELECT jobid,active,schedule FROM cron.job WHERE jobname='protectora-avisos-moderacion'")).rows
  console.log(JSON.stringify({jobs:existing}))
  if(!args.includes('--aplicar')) {console.log('Vista previa; no se modificó la base ni se envió ningún correo.');process.exitCode=0}
  else {
    const secret=process.env.CRON_SECRET?.trim()
    if(!secret || !/^[A-Za-z0-9_-]{43,}$/.test(secret)) throw Error('Configure CRON_SECRET con al menos 32 bytes aleatorios codificados en base64url, también en el servidor de producción.')
    await db.query('BEGIN')
    await db.query("SELECT pg_advisory_xact_lock(hashtext('protectora-avisos-cron'))")
    const current=(await db.query("SELECT id FROM vault.secrets WHERE name='protectora_avisos_cron'")).rows[0]
    if(current) await db.query('SELECT vault.update_secret($1,$2,$3,$4)',[current.id,secret,'protectora_avisos_cron','Autorización del worker privado de avisos'])
    else await db.query('SELECT vault.create_secret($1,$2,$3)',[secret,'protectora_avisos_cron','Autorización del worker privado de avisos'])
    await db.query(readFileSync(new URL('../db/avisos-cron.sql',import.meta.url),'utf8'))
    await db.query('SELECT cron.schedule($1,$2,$3)',['protectora-avisos-moderacion','*/5 * * * *','SELECT privado.despertar_worker_avisos();'])
    await db.query('COMMIT')
    const verification=(await db.query("SELECT count(*)::int n FROM cron.job WHERE jobname='protectora-avisos-moderacion' AND active AND schedule='*/5 * * * *'")).rows[0]
    if(verification.n!==1) throw Error('Revise la configuración: no se confirmó un único job activo.')
    console.log('Scheduler configurado: un job cada 5 minutos. Los secretos no aparecen en el comando del job.')
  }
} catch(error) {
  await db.query('ROLLBACK').catch(()=>{})
  // PostgreSQL errors can include bound credentials: never print their message.
  console.error(error instanceof Error && !('code' in error) ? error.message : 'No se pudo configurar el scheduler. Revise los permisos y las extensiones de Supabase.')
  process.exitCode=1
} finally {await db.end()}
