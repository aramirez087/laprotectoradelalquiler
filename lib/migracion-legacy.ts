import 'server-only'

import { spawn } from 'node:child_process'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { existeTablaLegacy } from '../scripts/legacy-tablas.mjs'
import { resumenDesdeSalida, type ResumenMigracion } from '@/lib/resultado-migracion-legacy'
export type { ResumenMigracion } from '@/lib/resultado-migracion-legacy'

export type ConexionLegacy = {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export type DiagnosticoLegacy = {
  tablas: number
  personas: number | null
  fichas: number | null
  usuarios: number | null
}

const TABLAS_DIAGNOSTICO = {
  personas: ['tb_persona'],
  fichas: ['tb_inquilinos_no_nacionales'],
  usuarios: ['users', 'tb_login'],
} as const

const MAX_SALIDA = 2 * 1024 * 1024
// Dejar margen para cerrar conexiones y responder antes del maxDuration (300 s).
const TIEMPO_LIMITE_MS = 4 * 60 * 1000

type GlobalMigracion = typeof globalThis & {
  __migracionLegacyEnCurso?: Promise<ResultadoEjecucion>
}

type ResultadoEjecucion = {
  resumen: ResumenMigracion
  observaciones: string[]
}

export function configuracionDestinoLegacy() {
  const databaseUrl =
    process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
  return {
    baseDatos: Boolean(databaseUrl),
    auth:
      Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
  }
}

async function contarSiExiste(
  conexion: mysql.Connection,
  tablas: readonly string[],
) {
  let total: number | null = null
  for (const tabla of tablas) {
    if (!(await existeTablaLegacy(conexion, tabla))) continue
    const [filas] = await conexion.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS total FROM \`${tabla}\``)
    total = (total ?? 0) + Number(filas[0]?.total ?? 0)
  }
  return total
}

export async function probarConexionLegacy(datos: ConexionLegacy): Promise<DiagnosticoLegacy> {
  const conexion = await mysql.createConnection({
    ...datos,
    charset: 'utf8mb4',
    connectTimeout: 15_000,
  })

  try {
    const [filas] = await conexion.query<mysql.RowDataPacket[]>(
      'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()',
    )
    const [personas, fichas, usuarios] = await Promise.all([
      contarSiExiste(conexion, TABLAS_DIAGNOSTICO.personas),
      contarSiExiste(conexion, TABLAS_DIAGNOSTICO.fichas),
      contarSiExiste(conexion, TABLAS_DIAGNOSTICO.usuarios),
    ])
    return { tablas: filas.length, personas, fichas, usuarios }
  } finally {
    await conexion.end()
  }
}

function mensajeSeguro(error: string, datos: ConexionLegacy) {
  let limpio = error
  const secretos = [
    datos.password,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SECRET_KEY,
  ].filter((valor): valor is string => Boolean(valor))

  for (const secreto of secretos) limpio = limpio.split(secreto).join('[oculto]')
  const lineas = limpio
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)
    .slice(-6)
  return lineas.join(' ') || 'La migración no pudo completarse.'
}

function ejecutarProceso(
  datos: ConexionLegacy,
  crearCuentas: boolean,
  simular: boolean,
  pasos?: 'usuarios',
  despuesDeAuth = 0,
): Promise<ResultadoEjecucion> {
  return new Promise((resolve, reject) => {
    const archivo = path.join(process.cwd(), 'scripts', 'migrar-legacy.mjs')
    const argumentos = [archivo]
    // Cada petición termina un lote; el vínculo guardado en usuarios permite continuar.
    if (pasos === 'usuarios') argumentos.push('--solo-accesos', '--limite-auth=100', '--tiempo-auth=150', `--despues-auth=${despuesDeAuth}`)
    if (crearCuentas) argumentos.push('--crear-accounts')
    if (simular) argumentos.push('--seco')

    const proceso = spawn(process.execPath, argumentos, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || '',
        LEGACY_MYSQL_HOST: datos.host,
        LEGACY_MYSQL_PORT: String(datos.port),
        LEGACY_MYSQL_USER: datos.user,
        LEGACY_MYSQL_PASSWORD: datos.password,
        LEGACY_MYSQL_DB: datos.database,
        FORCE_COLOR: '0',
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let salida = ''
    let errores = ''
    let excedioSalida = false
    const guardar = (actual: string, trozo: Buffer) => {
      if (actual.length + trozo.length > MAX_SALIDA) {
        excedioSalida = true
        return actual
      }
      return (actual + trozo.toString('utf8')).slice(0, MAX_SALIDA)
    }

    proceso.stdout.on('data', (trozo: Buffer) => {
      salida = guardar(salida, trozo)
    })
    proceso.stderr.on('data', (trozo: Buffer) => {
      errores = guardar(errores, trozo)
    })

    let forzarCierre: ReturnType<typeof setTimeout> | undefined
    const limite = setTimeout(() => {
      proceso.kill('SIGTERM')
      forzarCierre = setTimeout(() => proceso.kill('SIGKILL'), 5_000)
    }, TIEMPO_LIMITE_MS)

    proceso.once('error', (error) => {
      clearTimeout(limite)
      clearTimeout(forzarCierre)
      reject(new Error(mensajeSeguro(error.message, datos)))
    })

    proceso.once('close', (codigo, senal) => {
      clearTimeout(limite)
      clearTimeout(forzarCierre)
      if (senal) {
        reject(new Error(pasos === 'usuarios'
          ? 'El lote de accesos fue interrumpido. Los accesos completados se conservan; repita Crear accesos pendientes para continuar.'
          : salida.includes('Datos confirmados en Postgres.')
          ? 'Los datos se guardaron, pero la creación de accesos fue interrumpida. Reintente para completar los accesos.'
          : 'La importación fue interrumpida. Puede reintentarla sin duplicar registros; para importaciones grandes use el comando db:migrar desde el servidor.'))
        return
      }
      if (codigo !== 0 && codigo !== 2) {
        reject(new Error(mensajeSeguro(errores || salida, datos)))
        return
      }
      if (excedioSalida) {
        reject(new Error('La importación generó demasiados mensajes para mostrar un resultado confiable.'))
        return
      }

      try {
        const resumen = resumenDesdeSalida(salida, codigo)
        resolve({
          resumen,
          observaciones: resumen.advertencias.map((a) => `${a.mensaje} (${a.cantidad})`),
        })
      } catch (error) {
        reject(error)
      }
    })
  })
}

export async function ejecutarMigracionLegacy(
  datos: ConexionLegacy,
  crearCuentas: boolean,
  simular = false,
  pasos?: 'usuarios',
  despuesDeAuth = 0,
) {
  const estadoGlobal = globalThis as GlobalMigracion
  if (estadoGlobal.__migracionLegacyEnCurso) {
    throw new Error('Ya hay una importación en curso en este servidor. Espere a que termine.')
  }

  const ejecucion = ejecutarProceso(datos, crearCuentas, simular, pasos, despuesDeAuth)
  estadoGlobal.__migracionLegacyEnCurso = ejecucion
  try {
    return await ejecucion
  } finally {
    delete estadoGlobal.__migracionLegacyEnCurso
  }
}
