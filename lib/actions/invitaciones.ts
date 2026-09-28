'use server'

import { redirect, unstable_rethrow } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { AvisoAdmin } from '@/lib/admin'
import { aceptarInvitacionAdmin, invitarAdmin } from '@/lib/invitaciones-admin'
import type { EstadoForm } from './auth'

export async function invitarAdminAction(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  try {
    const resultado = await invitarAdmin({ nombre: String(formData.get('nombre') ?? ''), email: String(formData.get('email') ?? '').trim().toLowerCase(), enviarPorCorreo: formData.get('enviarPorCorreo') === '1' })
    return { mensaje: resultado.enviada ? 'Invitación enviada por correo.' : 'Invitación creada. Copie el enlace y envíelo a la persona invitada.',
      invitacion: { enlace: resultado.enlace, email: resultado.email }, advertencia: resultado.advertencia }
  } catch (e) {
    unstable_rethrow(e)
    return { error: e instanceof AvisoAdmin ? e.message : 'No se pudo crear la invitación.' }
  }
}

export async function aceptarInvitacionAction(id: string, token: string, _estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  try {
    await aceptarInvitacionAdmin({ id, token, clave: String(formData.get('clave') ?? ''), confirmacion: String(formData.get('confirmacion') ?? '') })
  } catch (e) {
    unstable_rethrow(e)
    return { error: e instanceof AvisoAdmin ? e.message : 'No se pudo aceptar la invitación. Pida un nuevo enlace.' }
  }
  revalidatePath('/', 'layout')
  redirect('/admin')
}
