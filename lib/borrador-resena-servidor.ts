import 'server-only'

import { createAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/registro-error'
import { CamposBorrador, type EstadoBorrador } from '@/lib/borrador-resena'

export async function obtenerBorradorResena(autorId: number, personaId: number | null): Promise<EstadoBorrador> {
  try {
    const db = createAdmin({ requestTimeoutMs: 8000 })
    if (!db) return { disponible: false, version: null, datos: null }
    const { data, error } = await db.rpc('leer_borrador_resena', { p_autor_id: autorId, p_persona_id: personaId })
    if (error) throw error
    const fila = data?.[0]
    return { disponible: true, version: fila?.version ?? null,
      datos: fila?.datos ? CamposBorrador.parse(fila.datos) : null }
  } catch (error) {
    registrarError('review_draft_read_error', error)
    return { disponible: false, version: null, datos: null }
  }
}
