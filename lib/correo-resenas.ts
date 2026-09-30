import 'server-only'

import { randomUUID } from 'node:crypto'
import { setTimeout as esperar } from 'node:timers/promises'
import * as z from 'zod'
import { plantillaCorreo, type ContenidoCorreo } from '@/lib/plantilla-correo'

const REMITENTE = 'La Protectora del Alquiler <no-reply@auth.protectoradelalquiler.com>'

export function correoResenasConfigurado() {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

/** Called only after the admin mutation commits; the recipient comes from the database. */
export async function notificarCambioResena(input: {
  solicitada: boolean
  accion: 'aprobada' | 'modificada' | 'eliminada'
  resenaId: number
  autor: { email: string; nombre: string } | null
}): Promise<{ mensaje?: string; advertencia?: string }> {
  if (!input.solicitada) return {}
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return { advertencia: 'La acción se guardó, pero no se envió correo: Resend aún no está configurado.' }

  const email = input.autor?.email.trim().toLowerCase() ?? ''
  if (!input.autor || !z.email().safeParse(email).success || /@(legacy\.laprotec|[^@]*\.invalid)$/.test(email)) {
    return { advertencia: 'La acción se guardó, pero el autor no tiene un correo válido para recibir notificaciones.' }
  }

  const mensajes = {
    aprobada: [
      `La administración aprobó y publicó su reseña #${input.resenaId}. Gracias por compartir su experiencia.`,
      'Puede ver su reseña y revisar su acceso al registro desde su perfil.',
    ],
    modificada: [
      `La administración modificó su reseña #${input.resenaId}.`,
      'Puede consultar la reseña actualizada en su perfil.',
    ],
    eliminada: [
      `La administración eliminó su reseña #${input.resenaId}.`,
      'La reseña ya no aparece en el registro. Puede consultar sus otras reseñas en su perfil.',
    ],
  }[input.accion]
  const parrafos = [`Hola, ${input.autor.nombre}.`, ...mensajes]
  const enviado = await enviarCorreo({
    to: email,
    subject: `Su reseña fue ${input.accion} · La Protectora del Alquiler`,
    contenido: {
      titulo: `Su reseña fue ${input.accion}`,
      resumen: 'Una actualización sobre su reseña en La Protectora del Alquiler.',
      parrafos,
      accion: { texto: 'Ver mis reseñas', url: 'https://www.protectoradelalquiler.com/perfil' },
    },
    text: [
      ...parrafos,
      'https://www.protectoradelalquiler.com/perfil',
      'La Protectora del Alquiler',
    ].join('\n\n'),
  })

  return enviado
    ? { mensaje: 'Notificación enviada al servicio de correo.' }
    : { advertencia: 'La acción se guardó, pero no pudimos confirmar el envío del correo. Revise la configuración y los registros de Resend antes de volver a avisar al autor.' }
}

/** Transport shared by review notices and administrative invitations. */
export async function enviarCorreo(input: { to: string; subject: string; text: string; contenido?: ContenidoCorreo }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return false
  const idempotencia = randomUUID()
  const body = JSON.stringify({ subject: input.subject, text: input.text,
    ...(input.contenido ? { html: plantillaCorreo(input.contenido) } : {}),
    from: process.env.RESEND_FROM_EMAIL?.trim() || REMITENTE, to: [input.to] })

  // Retry transient failures using the same idempotency key so an accepted
  // request whose response was lost cannot send the same notice twice.
  for (let intento = 0; intento < 2; intento++) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencia },
        body,
        signal: AbortSignal.timeout(10_000),
      })
      const result: unknown = await response.json()
      if (response.ok && result && typeof result === 'object' && 'id' in result && typeof result.id === 'string' && result.id) {
        return true
      }
      if (response.status !== 429 && response.status < 500) break
    } catch {
      // Do not expose provider errors, credentials or personal information.
    }
    if (intento === 0) await esperar(500)
  }
  return false
}
