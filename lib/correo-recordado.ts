export const COOKIE_CORREO = 'protectora-correo'

/** Correo que se puede volver a mostrar en el formulario de entrada. */
export function correoRecordado(valor: string | null | undefined) {
  const correo = (valor ?? '').trim().toLowerCase()
  if (correo.length < 6 || correo.length > 200) return ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return ''
  return correo
}
