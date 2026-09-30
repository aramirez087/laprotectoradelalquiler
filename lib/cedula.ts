export const PADRON_BUCKET = 'padron-tse'
export const PADRON_FUENTE = 'https://www.tse.go.cr/descarga_padron.html'

export interface NombrePadron {
  identificacion: string
  nombre: string
  nombre2: string
  apellido1: string
  apellido2: string
  nombreCompleto: string
}

export interface VerificacionCedula {
  identificacion: string
  estado: 'encontrada' | 'no_encontrada'
  fecha_padron: string
  nombre_tse: string | null
  consultado_en: string
}

export type ResultadoCedula =
  | { estado: 'encontrada'; fechaPadron: string; persona: NombrePadron }
  | { estado: 'no_encontrada' | 'desactualizado'; fechaPadron: string }
  | { estado: 'no_disponible' | 'no_aplica' }

/** Solo cédulas nacionales: nunca transformar letras o documentos extranjeros en una cédula. */
export function cedulaNacional(valor: string | null | undefined): string | null {
  const texto = (valor ?? '').trim()
  if (!/^[\d\s-]+$/.test(texto)) return null
  const digitos = texto.replace(/[\s-]/g, '')
  return /^[1-9]\d{8}$/.test(digitos) ? digitos : null
}

export function padronVigente(fecha: string, ahora = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const tiempo = Date.parse(`${fecha}T00:00:00Z`)
  if (!Number.isFinite(tiempo) || new Date(tiempo).toISOString().slice(0, 10) !== fecha) return false
  const edad = ahora - tiempo
  return edad >= 0 && edad <= 62 * 86_400_000
}

export function nombreDePadron(identificacion: string, nombres: string, apellido1: string, apellido2: string): NombrePadron {
  const partes = nombres.trim().split(/\s+/)
  return {
    identificacion, nombre: partes[0], nombre2: partes.slice(1).join(' '), apellido1, apellido2,
    nombreCompleto: [nombres, apellido1, apellido2].filter(Boolean).join(' '),
  }
}

export function nombresCoinciden(a: string, b: string) {
  const limpiar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim()
  return limpiar(a) === limpiar(b)
}

/** Los fragmentos están ordenados y contienen solo cédula, nombres y apellidos. */
export function buscarEnFragmento(lineas: string[], cedula: string): NombrePadron | null {
  let izquierda = 0
  let derecha = lineas.length - 1
  while (izquierda <= derecha) {
    const medio = (izquierda + derecha) >>> 1
    const id = lineas[medio].slice(0, 9)
    if (id < cedula) izquierda = medio + 1
    else if (id > cedula) derecha = medio - 1
    else {
      const campos = lineas[medio].split('\t')
      if (campos.length !== 4 || !campos[1] || !campos[2]) throw new Error('Fragmento del padrón inválido.')
      return nombreDePadron(campos[0], campos[1], campos[2], campos[3])
    }
  }
  return null
}
