'use server'

import { redirect, unstable_rethrow } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import * as z from 'zod'
import { crearResena, requireUsuario } from '@/lib/dal'
import { esCedulaValida } from '@/lib/util'
import type { EstadoForm } from './auth'

const SchemaResena = z.object({
  identificacion: z.string().trim().max(30).optional().or(z.literal('')),
  nombre: z.string().trim().min(2, 'Escriba el nombre'),
  nombre2: z.string().trim().max(100).optional().or(z.literal('')),
  apellido1: z.string().trim().min(2, 'Escriba el apellido'),
  apellido2: z.string().trim().max(100).optional().or(z.literal('')),
  provinciaId: z.coerce.number().int().optional().or(z.literal(0)),
  calificacionId: z.coerce.number().int().positive('Elija una calificación'),
  danoId: z.coerce.number().int().optional().or(z.literal(0)),
  procesoId: z.coerce.number().int().optional().or(z.literal(0)),
  contratoId: z.coerce.number().int().optional().or(z.literal(0)),
  tipoAlquilerId: z.coerce.number().int().optional().or(z.literal(0)),
  tiempoId: z.coerce.number().int().optional().or(z.literal(0)),
  recomienda: z.enum(['si', 'no', '']).optional(),
  drogas: z.enum(['si', 'no', '']).optional(),
  fechaInicio: z.string().max(10).optional().or(z.literal('')),
  fechaFin: z.string().max(10).optional().or(z.literal('')),
  comentario: z.string().trim().max(5000).optional().or(z.literal('')),
  detalleDano: z.string().trim().max(2000, 'El detalle del daño es muy largo').optional().or(z.literal('')),
  etiquetas: z.string().optional(),
})

const aNum = (v: number | undefined | 0): number | null => (v ? Number(v) : null)
const aBool = (v: string | undefined): boolean | null => (v === 'si' ? true : v === 'no' ? false : null)

export async function crearResenaAction(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const usuario = await requireUsuario()
  if (!usuario.activo) return { error: 'Su cuenta está inactiva y no puede publicar.' }

  const personaIdRaw = Number(formData.get('personaId'))
  const personaId = Number.isInteger(personaIdRaw) && personaIdRaw > 0 ? personaIdRaw : null

  const parsed = SchemaResena.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revise los datos de la reseña.' }
  const f = parsed.data

  if (!personaId && !esCedulaValida(f.identificacion)) {
    return { error: 'Escriba una cédula o documento válido.' }
  }
  if (f.fechaInicio && f.fechaFin && f.fechaFin < f.fechaInicio) {
    return { error: 'La fecha de fin no puede ser anterior al inicio.' }
  }

  const etiquetas = (f.etiquetas ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)

  try {
    const { personaId: fichaId, enRevision } = await crearResena({
      personaId,
      identificacion: f.identificacion ?? '',
      nombre: f.nombre,
      nombre2: f.nombre2 || undefined,
      apellido1: f.apellido1,
      apellido2: f.apellido2 || undefined,
      provinciaId: aNum(f.provinciaId || undefined),
      calificacionId: f.calificacionId,
      danoId: aNum(f.danoId || undefined),
      detalleDano: f.detalleDano || null,
      procesoId: aNum(f.procesoId || undefined),
      contratoId: aNum(f.contratoId || undefined),
      tipoAlquilerId: aNum(f.tipoAlquilerId || undefined),
      tiempoId: aNum(f.tiempoId || undefined),
      recomienda: aBool(f.recomienda),
      drogas: aBool(f.drogas),
      fechaInicio: f.fechaInicio || null,
      fechaFin: f.fechaFin || null,
      comentario: f.comentario || null,
      etiquetas,
      autorId: usuario.id,
    })
    revalidatePath('/fichas')
    revalidatePath(`/fichas/${fichaId}`)
    revalidatePath('/perfil')
    revalidatePath('/admin/revision')
    redirect(enRevision ? '/perfil?enviada=1' : `/fichas/${fichaId}`)
  } catch (e) {
    unstable_rethrow(e)
    return { error: e instanceof Error ? e.message : 'No se pudo guardar la reseña.' }
  }
}
