export type MotivoAcceso = 'ninguna' | 'revision' | 'rechazada' | 'vencida' | 'vigente' | 'administracion' | 'inactiva' | 'error'

export interface AccesoConsulta {
  usuario_id: number
  puede_consultar: boolean
  /** Experiencias distintas con al menos una reseña publicada. */
  aprobadas: number
  pendientes: number
  rechazadas: number
  ultima_aprobacion_en: string | null
  vence_en: string | null
  motivo: MotivoAcceso
}

export const REGLAS_CONSULTA = 'Cada experiencia de alquiler distinta, aprobada por administración, suma 3 meses. El tiempo no utilizado se acumula, hasta un máximo de 12 meses desde la última experiencia nueva aprobada. Editar o reenviar el mismo alquiler no suma tiempo.'

export function fechaVencimiento(fecha: string) {
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Costa_Rica',
  }).format(new Date(fecha))
}

export function mensajeAcceso(acceso: AccesoConsulta): string {
  switch (acceso.motivo) {
    case 'administracion': return 'Su cuenta de administración no necesita una reseña para acceder.'
    case 'inactiva': return 'Su cuenta está inactiva.'
    case 'vigente': return `Puede consultar hasta el ${fechaVencimiento(acceso.vence_en!)} (hora de Costa Rica).`
    case 'vencida': return `Su permiso de consulta venció${acceso.vence_en ? ` el ${fechaVencimiento(acceso.vence_en)} (hora de Costa Rica)` : ''}. ${acceso.pendientes > 0 ? 'Tiene una reseña en revisión. La aprobación inicial de una nueva experiencia renueva el acceso.' : 'Comparta una nueva experiencia y espere su aprobación para renovar el acceso.'}`
    case 'revision': return 'Su reseña está en revisión. El permiso de consulta comienza cuando administración la apruebe.'
    case 'rechazada': return 'Revise el motivo del rechazo en su perfil. Necesita una reseña aprobada para consultar.'
    case 'error': return 'No pudimos verificar su permiso de consulta. Intente de nuevo en un momento.'
    default: return 'Comparta su primera experiencia. Cuando administración la apruebe, tendrá 3 meses para consultar.'
  }
}
