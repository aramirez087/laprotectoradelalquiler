'use server'

import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import * as z from 'zod'
import { requerirRol } from '@/lib/dal'
import {
  configuracionDestinoLegacy,
  ejecutarMigracionLegacy,
  probarConexionLegacy,
  type DiagnosticoLegacy,
  type ResumenMigracion,
} from '@/lib/migracion-legacy'

export type EstadoMigracionLegacy = {
  error?: string
  mensaje?: string
  tipo?: 'conexion' | 'importacion' | 'simulacion'
  diagnostico?: DiagnosticoLegacy
  resumen?: ResumenMigracion
  observaciones?: string[]
} | undefined

const SchemaConexion = z.object({
  host: z.string().trim().min(1, 'Escriba el servidor.').max(255).regex(/^\S+$/, 'Revise el servidor.'),
  port: z.coerce.number().int().min(1).max(65535),
  database: z.string().trim().min(1, 'Escriba la base de datos.').max(128),
  user: z.string().trim().min(1, 'Escriba el usuario.').max(128),
  password: z.string().max(512),
  modo: z.enum(['probar', 'simular', 'importar']),
})

function mensajeConexion(error: unknown) {
  const mensaje = error instanceof Error ? error.message : ''
  if (/access denied|authentication|password/i.test(mensaje)) {
    return 'MySQL rechazó el usuario o la clave. Revise las credenciales.'
  }
  if (/unknown database/i.test(mensaje)) return 'MySQL no encontró esa base de datos.'
  if (/timeout|timed out|ETIMEDOUT/i.test(mensaje)) {
    return 'El servidor MySQL no respondió a tiempo. Revise el host, el puerto y el acceso de red.'
  }
  if (/ECONNREFUSED|ENOTFOUND|getaddrinfo/i.test(mensaje)) {
    return 'No pudimos llegar al servidor MySQL. Revise el host, el puerto y el acceso de red.'
  }
  return mensaje || 'No pudimos completar la operación.'
}

export async function migrarLegacyAction(
  _estado: EstadoMigracionLegacy,
  formData: FormData,
): Promise<EstadoMigracionLegacy> {
  const administrador = await requerirRol('admin')
  if (!administrador.activo) {
    return { error: 'Su cuenta está inactiva y no puede ejecutar importaciones.' }
  }

  const parsed = SchemaConexion.safeParse({
    host: formData.get('host'),
    port: formData.get('port'),
    database: formData.get('database'),
    user: formData.get('user'),
    password: formData.get('password') ?? '',
    modo: formData.get('modo'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revise los datos de conexión.' }
  }

  const { modo, ...conexion } = parsed.data
  try {
    if (modo === 'probar') {
      const diagnostico = await probarConexionLegacy(conexion)
      if (diagnostico.fichas == null) {
        return {
          tipo: 'conexion',
          error: 'MySQL respondió, pero no encontramos la tabla de fichas tb_inquilinos_no_nacionales. Revise la base de datos seleccionada.',
          diagnostico,
        }
      }
      return {
        tipo: 'conexion',
        mensaje: `Conexión lista. Encontramos ${diagnostico.tablas} tablas en el origen.`,
        diagnostico,
        observaciones: diagnostico.personas == null
          ? ['No existe tb_persona. Se pueden importar las personas de las fichas y solicitantes disponibles. Los accesos y autores sin identidad comprobable quedarán como perfiles legacy inactivos. Ejecute una simulación y revise las observaciones.']
          : [],
      }
    }

    if (modo === 'importar' && formData.get('confirmar') !== 'si') {
      return { error: 'Confirme que desea importar los datos antes de continuar.' }
    }
    const destino = configuracionDestinoLegacy()
    if (!destino.baseDatos) {
      return {
        error:
          'Falta la conexión a Postgres en el servidor. Configure DATABASE_URL o conecte el proyecto de Supabase desde Vercel.',
      }
    }
    const crearCuentas = modo === 'importar' && formData.get('crearCuentas') === 'on'
    if (crearCuentas && !destino.auth) {
      return {
        error: 'Para crear accesos faltan la URL y la clave secreta de Supabase en el servidor.',
      }
    }

    const resultado = await ejecutarMigracionLegacy(conexion, crearCuentas, modo === 'simular')
    if (modo === 'simular') {
      return {
        tipo: 'simulacion',
        mensaje: 'Simulación terminada. Se validaron los datos y las restricciones del destino; los cambios se revirtieron. Revise las observaciones antes de importar.',
        ...resultado,
      }
    }
    revalidatePath('/admin')
    revalidatePath('/admin/resenas')
    revalidatePath('/admin/usuarios')
    revalidatePath('/admin/reportes')
    revalidatePath('/fichas')
    return {
      tipo: 'importacion',
      ...(resultado.resumen.estado === 'parcial'
        ? { error: 'Los datos se importaron, pero faltan accesos en Supabase Auth. Reintente para completarlos.' }
        : { mensaje: resultado.observaciones.length
          ? 'Importación terminada con observaciones. Revise los datos que requieren atención.'
          : 'Importación terminada. Puede ejecutarla de nuevo sin duplicar registros.' }),
      ...resultado,
    }
  } catch (error) {
    unstable_rethrow(error)
    return { error: mensajeConexion(error) }
  }
}
