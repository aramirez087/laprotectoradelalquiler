'use server'

import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import * as z from 'zod'
import { actualizarUsuario, AvisoAdmin, decidirResena, resolverDenuncia } from '@/lib/admin'
import type { EstadoForm } from './auth'
import type { EstadoResena } from '@/lib/tipos'

const SchemaDecision = z.object({
  id: z.coerce.number().int().positive(),
  decision: z.enum(['publicar', 'rechazar', 'revisar']),
  nota: z.string().trim().max(2000).optional().or(z.literal('')),
})

const SchemaUsuario = z.object({
  id: z.coerce.number().int().positive(),
  rol: z.enum(['admin', 'propietario', 'agencia', 'inquilino']),
})

const SchemaDenuncia = z.object({
  id: z.coerce.number().int().positive(),
  decision: z.enum(['aceptar', 'rechazar']),
})

const ESTADO: Record<z.infer<typeof SchemaDecision>['decision'], EstadoResena> = {
  publicar: 'publicada',
  rechazar: 'oculta',
  revisar: 'borrador',
}

function aviso(e: unknown) {
  if (e instanceof AvisoAdmin) return e.message
  return 'No se pudo guardar.'
}

function revalidarResena(personaId?: number) {
  revalidatePath('/admin')
  revalidatePath('/admin/resenas')
  revalidatePath('/admin/revision')
  revalidatePath('/admin/rechazadas')
  revalidatePath('/admin/conteo')
  revalidatePath('/admin/reportes')
  revalidatePath('/fichas')
  revalidatePath('/perfil')
  if (personaId) revalidatePath(`/fichas/${personaId}`)
}

export async function decidirResenaAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const parsed = SchemaDecision.safeParse({
    id: formData.get('id'),
    decision: formData.get('decision'),
    nota: formData.get('nota') ?? '',
  })
  if (!parsed.success) return { error: 'Revise la decisión.' }

  try {
    const personaId = await decidirResena({
      id: parsed.data.id,
      estado: ESTADO[parsed.data.decision],
      nota: parsed.data.nota ?? '',
    })
    revalidarResena(personaId)
    return { mensaje: 'Listo.' }
  } catch (e) {
    unstable_rethrow(e)
    return { error: aviso(e) }
  }
}

export async function guardarUsuarioAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const parsed = SchemaUsuario.safeParse({
    id: formData.get('id'),
    rol: formData.get('rol'),
  })
  if (!parsed.success) return { error: 'Revise el usuario.' }

  try {
    await actualizarUsuario({
      id: parsed.data.id,
      rol: parsed.data.rol,
      activo: formData.get('activo') === 'on',
    })
    revalidatePath('/admin/usuarios')
    revalidatePath('/admin')
    return { mensaje: 'Cuenta actualizada.' }
  } catch (e) {
    unstable_rethrow(e)
    return { error: aviso(e) }
  }
}

export async function resolverDenunciaAction(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const parsed = SchemaDenuncia.safeParse({
    id: formData.get('id'),
    decision: formData.get('decision'),
  })
  if (!parsed.success) return { error: 'Revise la denuncia.' }

  try {
    const personaId = await resolverDenuncia({
      id: parsed.data.id,
      aceptar: parsed.data.decision === 'aceptar',
    })
    revalidarResena(personaId ?? undefined)
    return { mensaje: parsed.data.decision === 'aceptar' ? 'Denuncia aceptada. La reseña quedó rechazada.' : 'Denuncia rechazada.' }
  } catch (e) {
    unstable_rethrow(e)
    return { error: aviso(e) }
  }
}
