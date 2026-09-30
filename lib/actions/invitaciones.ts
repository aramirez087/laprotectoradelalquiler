'use server'

import { redirect, unstable_rethrow } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { AvisoAdmin } from '@/lib/admin'
import { aceptarInvitacionAdmin, cancelarInvitacionAdmin, invitarAdmin, type PropositoInvitacion } from '@/lib/invitaciones-admin'
import type { EstadoForm } from './auth'

export async function invitarAdminAction(_estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  if (formData.get('confirmar') !== '1') return { error: 'Confirme los permisos que recibirá la persona invitada.' }
  const proposito = formData.get('proposito') ?? 'administracion'
  if (proposito !== 'administracion' && proposito !== 'acceso') return { error: 'Revise el propósito de la invitación.' }
  try {
    const resultado = await invitarAdmin({ nombre: String(formData.get('nombre') ?? ''), email: String(formData.get('email') ?? '').trim().toLowerCase(), enviarPorCorreo: formData.get('enviarPorCorreo') === '1', proposito })
    revalidatePath('/admin/usuarios')
    return { mensaje: resultado.enviada ? 'Invitación enviada por correo.' : 'Invitación creada. Copie el enlace y envíelo a la persona invitada.',
      invitacion: { enlace: resultado.enlace, email: resultado.email, venceEn: resultado.venceEn, proposito: resultado.proposito }, advertencia: resultado.advertencia }
  } catch (e) {
    unstable_rethrow(e)
    return { error: e instanceof AvisoAdmin ? e.message : 'No se pudo crear la invitación.' }
  }
}

export async function cancelarInvitacionAdminAction(id: string, _estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  if (formData.get('confirmar') !== '1') return { error: 'Confirme que desea cancelar esta invitación.' }
  try {
    await cancelarInvitacionAdmin(id)
    revalidatePath('/admin/usuarios')
    return { mensaje: 'Invitación cancelada. El enlace ya no concede acceso.' }
  } catch (e) {
    unstable_rethrow(e)
    return { error: e instanceof AvisoAdmin ? e.message : 'No se pudo cancelar la invitación.' }
  }
}

export async function aceptarInvitacionAction(id: string, token: string, _estado: EstadoForm, formData: FormData): Promise<EstadoForm> {
  let proposito: PropositoInvitacion
  try {
    ;({ proposito } = await aceptarInvitacionAdmin({ id, token, clave: String(formData.get('clave') ?? ''), confirmacion: String(formData.get('confirmacion') ?? '') }))
  } catch (e) {
    unstable_rethrow(e)
    return { error: e instanceof AvisoAdmin ? e.message : 'No se pudo aceptar la invitación. Pida un nuevo enlace.' }
  }
  revalidatePath('/', 'layout')
  redirect(proposito === 'administracion' ? '/admin' : '/perfil')
}
