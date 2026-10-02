import 'server-only'

import { cedulaNacional, nombresCoinciden } from '@/lib/cedula'
import { consultarCedula } from '@/lib/padron'
import { moderarContenidoResena } from '@/lib/moderacion-contenido'
import { createAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/registro-error'

type ResenaParaModerar = {
  id: number
  version: number
  estado: string
  autor_id: number
  comentario: string | null
  detalle_dano: string | null
  autor: { identificacion: string | null; activo: boolean } | null
  persona: {
    identificacion: string | null
    nombre: string
    nombre2: string | null
    apellido1: string
    apellido2: string | null
  } | null
}

/** Only server submission/correction paths call this after durably saving a draft.
 * The model cannot mutate reviews; the RPC rechecks the exact saved version,
 * both identities and the current TSE proofs before committing publication.
 */
export async function intentarAprobacionAutomatica(input: { id: number; autorId: number; version: number }): Promise<boolean> {
  if (process.env.MODERACION_AUTOMATICA_ENABLED !== '1') return false
  let db: ReturnType<typeof createAdmin> = null
  try {
    db = createAdmin({ requestTimeoutMs: 8000 })
    if (!db) return false
    const { data, error } = await db.from('resenas')
      .select(`id, version, estado, autor_id, comentario, detalle_dano,
        autor:usuarios!resenas_autor_id_fkey(identificacion, activo),
        persona:personas(identificacion, nombre, nombre2, apellido1, apellido2)`)
      .eq('id', input.id).eq('autor_id', input.autorId).maybeSingle()
    if (error) throw error
    const resena = data as ResenaParaModerar | null
    if (resena?.estado === 'publicada') return true
    if (!resena || resena.estado !== 'borrador' || resena.version !== input.version
      || !resena.autor || !resena.persona) return false

    const autorCedula = cedulaNacional(resena.autor.identificacion)
    const personaCedula = cedulaNacional(resena.persona.identificacion)
    let resultado: { decision: 'segura' | 'revision'; motivo: string; modelo: string | null; politica: 'resenas-v1'; categorias: string[] } = {
      decision: 'revision', motivo: 'contenido_incierto', modelo: null, politica: 'resenas-v1', categorias: [],
    }
    if (!resena.autor.activo) resultado.motivo = 'autor_inactivo'
    else if (!autorCedula) resultado.motivo = 'cedula_autor_no_verificada'
    else if (!personaCedula) resultado.motivo = 'cedula_inquilino_no_verificada'
    else {
      // Never ask the LLM whether an identity exists. Both proofs come from TSE.
      const [autor, inquilino] = await Promise.all([
        consultarCedula(autorCedula, true), consultarCedula(personaCedula, true),
      ])
      if (autor.estado !== 'encontrada') resultado.motivo = 'cedula_autor_no_verificada'
      else if (inquilino.estado !== 'encontrada') resultado.motivo = 'cedula_inquilino_no_verificada'
      else if (!nombresCoinciden(
        [resena.persona.nombre, resena.persona.nombre2, resena.persona.apellido1, resena.persona.apellido2].filter(Boolean).join(' '),
        inquilino.persona.nombreCompleto,
      )) resultado.motivo = 'nombre_inquilino_no_coincide'
      else if (!process.env.GROQ_API_KEY?.trim()) resultado.motivo = 'moderacion_no_configurada'
      else {
        // Claim the saved version and consume shared/per-author budgets atomically.
        // Duplicate submissions and exhausted budgets remain in the human queue.
        const cupo = await db.rpc('consumir_cupo_moderacion_resena', { p_id: resena.id, p_version: resena.version })
        if (cupo.error) throw cupo.error
        if (cupo.data !== true) resultado.motivo = 'moderacion_limite'
        else resultado = await moderarContenidoResena(resena.comentario ?? '', resena.detalle_dano)
      }
    }

    const resolucion = await db.rpc('resolver_moderacion_automatica_resena', {
      p_id: resena.id, p_version: resena.version,
      p_comentario: resena.comentario, p_detalle_dano: resena.detalle_dano,
      p_autor_cedula: autorCedula, p_persona_cedula: personaCedula, p_resultado: resultado,
    }).single<{ publicada: boolean }>()
    if (resolucion.error) throw resolucion.error
    return resolucion.data?.publicada === true
  } catch (error) {
    // Submission is already saved. Neither provider nor audit outages lose it
    // or expose raw review content in the error logs.
    registrarError('automatic_review_moderation_error', error)
    if (db) {
      // An acknowledgement can be lost after commit. Re-read authoritative state
      // before telling the caller to display a published or receipt outcome.
      try {
        const actual = await db.from('resenas').select('estado').eq('id', input.id).eq('autor_id', input.autorId).maybeSingle()
        if (!actual.error && actual.data?.estado === 'publicada') return true
      } catch { /* The profile receipt remains neutral when confirmation is unavailable. */ }
    }
    return false
  }
}
