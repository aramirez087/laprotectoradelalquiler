/** Ephemeral, bounded drafts. Never serialize this store to browser storage. */
export function crearAlmacenBorradores(limite = 50) {
  if (!Number.isInteger(limite) || limite < 1) throw new RangeError('El límite de borradores debe ser positivo.')
  const valores = new Map<string, unknown>()
  return {
    obtener<T>(clave: string): T | undefined {
      return valores.get(clave) as T | undefined
    },
    guardar<T>(clave: string, valor: T) {
      valores.delete(clave)
      valores.set(clave, valor)
      while (valores.size > limite) valores.delete(valores.keys().next().value!)
    },
    eliminar(clave: string) {
      valores.delete(clave)
    },
    limpiar() {
      valores.clear()
    },
  }
}

export const borradoresAdmin = crearAlmacenBorradores()
