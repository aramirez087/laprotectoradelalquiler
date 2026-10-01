'use server'

import * as z from 'zod'
import { requireUsuario, puedeConsultar } from '@/lib/dal'
import { createAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/registro-error'
import { CamposBorrador, type DatosBorrador } from '@/lib/borrador-resena'

const Entrada = z.object({ personaId: z.number().int().positive().nullable(), version: z.uuid().nullable(),
  datos: CamposBorrador.nullable() }).strict()

export async function guardarBorradorResena(input: { personaId: number | null; version: string | null; datos: DatosBorrador | null }) {
  const usuario = await requireUsuario('/resenas/nueva')
  const parsed = Entrada.safeParse(input)
  if (!usuario.activo || !parsed.success) return { error: 'No pudimos guardar el borrador. Revise su cuenta y los campos.' }
  if (input.personaId && !(await puedeConsultar(usuario))) return { error: 'Su permiso cambió. Revise su perfil antes de continuar.' }
  try {
    const db = createAdmin({ requestTimeoutMs: 8000 })
    if (!db) throw new Error('Draft storage unavailable')
    const { data, error } = await db.rpc('guardar_borrador_resena', { p_autor_id: usuario.id,
      p_persona_id: parsed.data.personaId, p_version: parsed.data.version, p_datos: parsed.data.datos })
    if (error) throw error
    const fila = data?.[0]
    if (!fila?.guardado) return { conflicto: true, error: 'Este borrador cambió en otra pestaña o dispositivo. Copie sus cambios y vuelva a cargar la página para revisar la versión guardada.' }
    return { version: fila.version as string }
  } catch (error) {
    registrarError('review_draft_save_error', error)
    return { error: 'No pudimos guardar el borrador. Sus datos siguen en esta página. Intente guardar de nuevo antes de salir.' }
  }
}
