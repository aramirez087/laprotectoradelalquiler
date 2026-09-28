'use server'

import { revalidatePath } from 'next/cache'
import * as z from 'zod'
import { puedeConsultar, requireUsuario } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import type { EstadoForm } from './auth'

const SchemaDenuncia = z.object({
  resenaId: z.coerce.number().int().positive(),
  motivo: z.enum(['informacion_falsa', 'difamacion', 'datos_incorrectos', 'otro']),
  detalle: z.string().trim().max(2000).optional().or(z.literal('')),
})

export async function denunciar(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const usuario = await requireUsuario()
  if (!usuario.activo) return { error: 'Su cuenta está inactiva y no puede denunciar.' }
  if (!(await puedeConsultar(usuario))) {
    return { error: 'Necesita un permiso de consulta vigente para denunciar una reseña.' }
  }

  const parsed = SchemaDenuncia.safeParse({
    resenaId: formData.get('resenaId'),
    motivo: formData.get('motivo'),
    detalle: formData.get('detalle') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revise la denuncia.' }

  const supabase = await createClient()
  const { data: resena, error: errorResena } = await supabase
    .from('resenas')
    .select('id')
    .eq('id', parsed.data.resenaId)
    .maybeSingle()
  if (errorResena) return { error: 'No pudimos revisar esa reseña.' }
  if (!resena) return { error: 'No encontramos esa reseña.' }

  const { data: previa, error: errorPrevia } = await supabase
    .from('denuncias')
    .select('id')
    .eq('resena_id', parsed.data.resenaId)
    .eq('denunciante_id', usuario.id)
    .limit(1)
  if (errorPrevia) return { error: 'No pudimos enviar la denuncia.' }
  if (previa && previa.length > 0) {
    return { mensaje: 'Ya habíamos recibido su denuncia sobre esta reseña.' }
  }

  const { error } = await supabase.from('denuncias').insert({
    resena_id: parsed.data.resenaId,
    denunciante_id: usuario.id,
    motivo: parsed.data.motivo,
    detalle: parsed.data.detalle || null,
  })
  if (error) return { error: 'No pudimos enviar la denuncia. Intente de nuevo.' }

  revalidatePath('/fichas', 'layout')
  return { mensaje: 'Gracias. Su denuncia quedó registrada para revisión.' }
}
