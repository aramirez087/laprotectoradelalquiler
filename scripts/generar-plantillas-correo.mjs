import { mkdir, writeFile } from 'node:fs/promises'
import { plantillaCorreo } from '../lib/plantilla-correo.ts'

const confirmacion = '{{ .ConfirmationURL }}'
const enlaceAuth = (tipo) => `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=${tipo}`
const ignorar = 'Si no solicitó este mensaje, puede ignorarlo. No comparta este enlace con otras personas.'
const plantillas = [
  { id: 'reset-password', clave: 'recovery', asunto: 'Recupere su acceso · La Protectora del Alquiler', titulo: 'Elija una clave nueva', resumen: 'Un enlace seguro para recuperar el acceso a su cuenta.', parrafos: ['Recibimos una solicitud para restablecer la clave de su cuenta.', 'Abra el enlace para elegir una clave nueva. Puede hacerlo desde su teléfono u otro navegador.'], accion: { texto: 'Elegir una clave nueva', url: enlaceAuth('recovery') }, nota: 'Este enlace es de un solo uso. Si venció o ya lo utilizó, solicite uno nuevo en la página de recuperación. Si no hizo esta solicitud, ignore el mensaje; su clave no cambiará.' },
  { id: 'confirm-sign-up', clave: 'confirmation', asunto: 'Confirme su correo · La Protectora del Alquiler', titulo: 'Confirme su correo', resumen: 'Confirme su dirección para continuar con su cuenta.', parrafos: ['Gracias por crear su cuenta en La Protectora del Alquiler.', 'Confirme esta dirección de correo para escribir su primera reseña. Puede abrir el enlace desde su teléfono u otro navegador.'], accion: { texto: 'Confirmar mi correo', url: enlaceAuth('signup') }, nota: ignorar },
  { id: 'invite-user', clave: 'invite', asunto: 'Su invitación · La Protectora del Alquiler', titulo: 'Tiene una invitación', resumen: 'Un enlace para aceptar su invitación y continuar con su cuenta.', parrafos: ['Recibió una invitación para acceder a La Protectora del Alquiler.', 'Abra el enlace y siga los pasos que aparecen en el sitio para completar su acceso.'], accion: { texto: 'Aceptar invitación', url: confirmacion }, nota: 'Si no esperaba esta invitación, ignore el mensaje. El enlace es de un solo uso; no lo comparta.' },
  { id: 'magic-link-or-otp', clave: 'magic_link', asunto: 'Su enlace de acceso · La Protectora del Alquiler', titulo: 'Continúe con su cuenta', resumen: 'Su enlace de un solo uso para iniciar sesión.', parrafos: ['Recibimos una solicitud para iniciar sesión con este correo.', 'Abra el enlace en el mismo navegador donde lo solicitó para entrar a su cuenta.'], accion: { texto: 'Iniciar sesión', url: confirmacion }, nota: ignorar },
  { id: 'change-email-address', clave: 'email_change', asunto: 'Confirme el cambio de correo · La Protectora del Alquiler', titulo: 'Confirme el cambio de correo', resumen: 'Verifique la solicitud de cambio de correo de su cuenta.', parrafos: ['Recibimos una solicitud para cambiar el correo de su cuenta.', 'Confirme el cambio con el siguiente enlace. Si recibió mensajes en ambas direcciones, siga las instrucciones de cada uno para completar la verificación.'], accion: { texto: 'Confirmar cambio de correo', url: confirmacion }, nota: 'Si no solicitó este cambio, no abra el enlace y revise la seguridad de su cuenta desde el sitio. No comparta este enlace.' },
  { id: 'reauthentication', clave: 'reauthentication', asunto: 'Su código de verificación · La Protectora del Alquiler', titulo: 'Confirme que es usted', resumen: 'Su código de un solo uso para confirmar una acción en su cuenta.', parrafos: ['Introduzca este código en la página donde inició la solicitud para confirmar su identidad.'], codigo: '{{ .Token }}', nota: 'No comparta este código. Si venció, solicite uno nuevo en el sitio. Si no inició esta solicitud, ignore el mensaje.' },
]
const carpeta = new URL('../emails/supabase/', import.meta.url)
await mkdir(carpeta, { recursive: true })
const configuracion = {}
for (const plantilla of plantillas) {
  const html = plantillaCorreo(plantilla)
  await writeFile(new URL(`${plantilla.id}.html`, carpeta), html)
  configuracion[`mailer_subjects_${plantilla.clave}`] = plantilla.asunto
  configuracion[`mailer_templates_${plantilla.clave}_content`] = html
}
await writeFile(new URL('config.json', carpeta), JSON.stringify(configuracion, null, 2) + '\n')
console.log(`Generadas ${plantillas.length} plantillas de autenticación.`)
