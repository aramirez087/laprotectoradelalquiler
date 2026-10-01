export type MotivoAcceso = 'ninguna' | 'revision' | 'rechazada' | 'vencida' | 'vigente' | 'administracion' | 'inactiva' | 'error'

export interface AccesoConsulta {
  usuario_id: number
  puede_consultar: boolean
  /** Inquilinos distintos con al menos una reseña publicada de este autor. */
  aprobadas: number
  pendientes: number
  rechazadas: number
  ultima_aprobacion_en: string | null
  vence_en: string | null
  motivo: MotivoAcceso
}

export const REGLAS_CONSULTA = 'Su primera reseña sobre cada inquilino, aprobada por administración, suma 3 meses. El tiempo no utilizado se acumula, hasta un máximo de 12 meses desde la última aprobación sobre un inquilino nuevo para usted. Solo puede enviar una reseña por inquilino. Editarla o volver a publicarla no suma tiempo.'

export const BENEFICIO_CONSULTA = 'Su primera reseña aprobada sobre cada inquilino le da 3 meses para consultar. Puede acumular hasta 12 meses de acceso.'

/** Solo presentación. La autorización siempre la decide Postgres. */
export function accesoEnPantalla(acceso: AccesoConsulta, ahora: number): AccesoConsulta {
  if (acceso.motivo === 'vigente' && acceso.vence_en && Date.parse(acceso.vence_en) <= ahora) {
    return { ...acceso, puede_consultar: false, motivo: 'vencida' }
  }
  return acceso
}

export function tiempoRestante(venceEn: string, ahora: number): string {
  const restante = Date.parse(venceEn) - ahora
  if (!Number.isFinite(restante)) return 'Por verificar'
  if (restante <= 0) return 'Acceso vencido'
  const dias = Math.floor(restante / 86_400_000)
  if (dias > 0) return `${dias} ${dias === 1 ? 'día' : 'días'}`
  const horas = Math.floor(restante / 3_600_000)
  if (horas > 0) return `${horas} ${horas === 1 ? 'hora' : 'horas'}`
  return 'Menos de 1 hora'
}

export function tituloAcceso(acceso: AccesoConsulta): string {
  switch (acceso.motivo) {
    case 'vigente': return 'Acceso activo'
    case 'vencida': return 'Acceso vencido'
    case 'revision': return 'Reseña en revisión'
    case 'rechazada': return 'Reseña no aprobada'
    case 'inactiva': return 'Cuenta inactiva'
    case 'administracion': return 'Acceso de administración'
    case 'error': return 'Acceso por verificar'
    default: return 'Comparta su primera experiencia'
  }
}

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
    case 'vencida': return `Su permiso de consulta venció${acceso.vence_en ? ` el ${fechaVencimiento(acceso.vence_en)} (hora de Costa Rica)` : ''}. ${acceso.pendientes > 0 ? 'Tiene una reseña en revisión. La primera aprobación sobre un inquilino que usted aún no ha reseñado renueva el acceso.' : 'Comparta una experiencia con un inquilino que usted aún no ha reseñado y espere su aprobación para renovar el acceso.'}`
    case 'revision': return 'Su reseña está en revisión. El permiso de consulta comienza cuando administración la apruebe.'
    case 'rechazada': return 'Revise el motivo en su perfil. Si administración solicitó correcciones, puede corregir y reenviar la misma reseña. Necesita una reseña aprobada para consultar.'
    case 'error': return 'No pudimos verificar su permiso de consulta. Intente de nuevo en un momento.'
    default: return 'Comparta su primera experiencia. Cuando administración la apruebe, tendrá 3 meses para consultar.'
  }
}
