export type TipoBusqueda = 'listado' | 'nombre' | 'documento' | 'invalida'
export type CoincidenciaFicha = 'documento_exacto' | 'documento_parcial' | 'nombre_completo' | 'palabras_completas' | 'nombre_parcial'

/** Shared presentation/validation; the database independently validates the query. */
export function analizarBusqueda(entrada: string): { tipo: TipoBusqueda; valor: string; ayuda?: string } {
  const valor = entrada.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!valor) return { tipo: 'listado', valor }
  if (valor.length > 150) return { tipo: 'invalida', valor, ayuda: 'Use hasta 150 caracteres para buscar.' }
  if (/^[\d\s.-]+$/.test(valor) || /^[a-z]{1,4}[\s.-]*\d[a-z\d\s.-]*$/i.test(valor)) {
    const documento = valor.replace(/[\s.-]/g, '').toLowerCase()
    if (documento.length < 4) return { tipo: 'invalida', valor, ayuda: 'Escriba al menos 4 caracteres del documento. Para identificar a la persona, use el número completo.' }
    return { tipo: 'documento', valor: documento }
  }
  const palabras = valor.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(p => p.length >= 2)
  if (!palabras.length || palabras.length > 12) return { tipo: 'invalida', valor, ayuda: 'Escriba un nombre o apellido de al menos 2 letras, o el documento completo.' }
  return { tipo: 'nombre', valor }
}

export function etiquetaCoincidencia(coincidencia?: CoincidenciaFicha) {
  switch (coincidencia) {
    case 'documento_exacto': return 'Coincide el documento completo'
    case 'documento_parcial': return 'Coincidencia parcial de documento'
    case 'nombre_completo': return 'Coincide el nombre completo'
    case 'palabras_completas': return 'Coinciden las palabras del nombre'
    case 'nombre_parcial': return 'Coincidencia parcial de nombre'
    default: return null
  }
}
