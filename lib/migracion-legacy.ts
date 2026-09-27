import 'server-only'

import { spawn } from 'node:child_process'
import path from 'node:path'
import mysql from 'mysql2/promise'

export type ConexionLegacy = {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export type ResumenMigracion = {
  lookups: Record<string, number>
  personas: number
  usuarios: number
  resenas: number
  claves: {
    bcrypt: number
    anterior: number
    restablecer: number
  }
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
const TIEMPO_LIMITE_MS = 5 * 60 * 1000

type GlobalMigracion = typeof globalThis & {
  __migracionLegacyEnCurso?: Promise<ResultadoEjecucion>
}

type ResultadoEjecucion = {
  resumen: ResumenMigracion
  observaciones: string[]
}

export function configuracionDestinoLegacy() {
  return {
    baseDatos: Boolean(process.env.DATABASE_URL),
    auth:
      Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
  }
}

async function contarSiExiste(
  conexion: mysql.Connection,
  tablas: readonly string[],
  existentes: Set<string>,
) {
  const tabla = tablas.find((nombre) => existentes.has(nombre))
  if (!tabla) return null
  const [filas] = await conexion.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS total FROM \`${tabla}\``)
  return Number(filas[0]?.total ?? 0)
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
    const existentes = new Set(filas.map((fila) => String(fila.TABLE_NAME ?? fila.table_name)))
    const [personas, fichas, usuarios] = await Promise.all([
      contarSiExiste(conexion, TABLAS_DIAGNOSTICO.personas, existentes),
      contarSiExiste(conexion, TABLAS_DIAGNOSTICO.fichas, existentes),
      contarSiExiste(conexion, TABLAS_DIAGNOSTICO.usuarios, existentes),
    ])
    return { tablas: existentes.size, personas, fichas, usuarios }
  } finally {
    await conexion.end()
  }
}

function resumenDesdeSalida(salida: string): ResumenMigracion {
  const marcador = '=== Resumen ==='
  const inicio = salida.lastIndexOf(marcador)
  if (inicio < 0) throw new Error('La migración terminó sin entregar un resumen.')

  const texto = salida.slice(inicio + marcador.length).trim()
  const resumen = JSON.parse(texto) as Partial<ResumenMigracion>
  if (
    !resumen.lookups ||
    typeof resumen.personas !== 'number' ||
    typeof resumen.usuarios !== 'number' ||
    typeof resumen.resenas !== 'number' ||
    !resumen.claves
  ) {
    throw new Error('La migración entregó un resumen incompleto.')
  }
  return resumen as ResumenMigracion
}

function observacionesDesdeSalida(salida: string) {
  return salida
    .split('\n')
    .map((linea) => linea.trim())
    .filter(
      (linea) =>
        linea.startsWith('✗') ||
        linea.includes('sin persona:') ||
        linea.startsWith('Auth:'),
    )
    .slice(-12)
}

function mensajeSeguro(error: string, datos: ConexionLegacy) {
  let limpio = error
  const secretos = [
    datos.password,
    process.env.DATABASE_URL,
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

function ejecutarProceso(datos: ConexionLegacy, crearCuentas: boolean): Promise<ResultadoEjecucion> {
  return new Promise((resolve, reject) => {
    const archivo = path.join(process.cwd(), 'scripts', 'migrar-legacy.mjs')
    const argumentos = [archivo]
    if (crearCuentas) argumentos.push('--crear-accounts')

    const proceso = spawn(process.execPath, argumentos, {
      cwd: process.cwd(),
      env: {
        ...process.env,
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
      if (actual.length >= MAX_SALIDA) {
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

    const limite = setTimeout(() => {
      proceso.kill('SIGTERM')
    }, TIEMPO_LIMITE_MS)

    proceso.once('error', (error) => {
      clearTimeout(limite)
      reject(new Error(mensajeSeguro(error.message, datos)))
    })

    proceso.once('close', (codigo, senal) => {
      clearTimeout(limite)
      if (senal) {
        reject(new Error('La importación superó el límite de 5 minutos y fue detenida.'))
        return
      }
      if (codigo !== 0) {
        reject(new Error(mensajeSeguro(errores || salida, datos)))
        return
      }
      if (excedioSalida) {
        reject(new Error('La importación generó demasiados mensajes para mostrar un resultado confiable.'))
        return
      }

      try {
        resolve({
          resumen: resumenDesdeSalida(salida),
          observaciones: observacionesDesdeSalida(`${salida}\n${errores}`),
        })
      } catch (error) {
        reject(error)
      }
    })
  })
}

export async function ejecutarMigracionLegacy(datos: ConexionLegacy, crearCuentas: boolean) {
  const estadoGlobal = globalThis as GlobalMigracion
  if (estadoGlobal.__migracionLegacyEnCurso) {
    throw new Error('Ya hay una importación en curso en este servidor. Espere a que termine.')
  }

  const ejecucion = ejecutarProceso(datos, crearCuentas)
  estadoGlobal.__migracionLegacyEnCurso = ejecucion
  try {
    return await ejecucion
  } finally {
    delete estadoGlobal.__migracionLegacyEnCurso
  }
}
