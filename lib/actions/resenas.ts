'use server'

import { registrarError } from '@/lib/registro-error'

import { redirect, unstable_rethrow } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import * as z from 'zod'
import { crearResena, listarResenasDe, requireUsuario } from '@/lib/dal'
import { esCedulaValida } from '@/lib/util'
import type { EstadoForm } from './auth'

const CamposPersona = {
  identificacion: z.string().trim().max(30).optional().or(z.literal('')),
  nombre: z.string().trim().min(1, 'Escriba el nombre'),
  nombre2: z.string().trim().max(100).optional().or(z.literal('')),
  apellido1: z.string().trim().min(1, 'Escriba el apellido'),
  apellido2: z.string().trim().max(100).optional().or(z.literal('')),
}

const SchemaResena = z.object({
  ...CamposPersona,
  comentario: z
    .string()
    .trim()
    .min(30, 'Cuéntenos un poco más. Unas pocas frases bastan.')
    .max(5000, 'El relato es muy largo'),
})

export async function crearResenaAction(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const usuario = await requireUsuario()
  if (!usuario.activo) return { error: 'Su cuenta está inactiva y no puede publicar.' }

  const personaIdRaw = Number(formData.get('personaId'))
  const personaId = Number.isInteger(personaIdRaw) && personaIdRaw > 0 ? personaIdRaw : null
  const registro = formData.get('modo') === 'registro'

  if (registro) {
    try {
      const propias = await listarResenasDe(usuario.id)
      if (propias.length > 0) return { error: 'Ya envió su primera reseña. Puede verla en su perfil.' }
    } catch (e) {
      unstable_rethrow(e)
      registrarError('review_check_error', e, { routeType: 'action' })
      return { error: 'No pudimos revisar sus reseñas. Intente de nuevo.' }
    }
  }

  const parsed = SchemaResena.safeParse(Object.fromEntries(formData))
  if (!parsed.success)
    return {
      error: 'Revise los campos indicados. Sus datos se conservan.',
      campos: Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])),
    }
  const f = parsed.data

  if (!personaId && !esCedulaValida(f.identificacion)) {
    return {
      error: 'Revise el documento. Sus datos se conservan.',
      campos: { identificacion: 'Escriba un documento de 6 a 12 dígitos; puede incluir guiones.' },
    }
  }

  try {
    const { personaId: fichaId, enRevision } = await crearResena({
      personaId,
      identificacion: f.identificacion ?? '',
      nombre: f.nombre,
      nombre2: f.nombre2 || undefined,
      apellido1: f.apellido1,
      apellido2: f.apellido2 || undefined,
      comentario: f.comentario,
      etiquetas: [],
      autorId: usuario.id,
      anonima: formData.get('anonima') === '1',
    })
    revalidatePath('/fichas')
    revalidatePath(`/fichas/${fichaId}`)
    revalidatePath('/perfil')
    revalidatePath('/admin/revision')
    redirect(enRevision ? '/perfil?enviada=1' : `/fichas/${fichaId}`)
  } catch (e) {
    unstable_rethrow(e)
    const mensaje = e instanceof Error ? e.message : ''
    const propio = /^(No |Su cuenta|Revise )/.test(mensaje) && !/relation|policy|permission|jwt|duplicate key/i.test(mensaje)
    if (!propio) registrarError('review_save_error', e, { routeType: 'action' })
    return { error: propio ? mensaje : 'No se pudo guardar la reseña.' }
  }
}
