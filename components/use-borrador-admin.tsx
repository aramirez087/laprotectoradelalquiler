'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { borradoresAdmin, crearAlmacenBorradores } from '@/lib/borradores-admin'

const ContextoBorradores = createContext(borradoresAdmin)

/** Keep unsaved edits across client-side Back/Forward within administration. */
export function useBorradorAdmin<T>(clave: string, inicial: T, esPendiente: (valor: T) => boolean) {
  const almacen = useContext(ContextoBorradores)
  const [borrador, setBorrador] = useState<T>(() =>
    typeof window === 'undefined' ? inicial : almacen.obtener<T>(clave) ?? inicial,
  )
  const pendiente = esPendiente(borrador)
  useEffect(() => {
    if (pendiente) almacen.guardar(clave, borrador)
    else almacen.eliminar(clave)
  }, [almacen, clave, borrador, pendiente])
  return [borrador, setBorrador, () => almacen.eliminar(clave)] as const
}

/** Leaving administration ends the lifetime of its private in-memory drafts. */
export function SesionBorradoresAdmin({ children }: { children: ReactNode }) {
  const [almacen] = useState(() => crearAlmacenBorradores())
  useEffect(() => {
    window.addEventListener('admin-descartar-ediciones', almacen.limpiar)
    return () => {
      window.removeEventListener('admin-descartar-ediciones', almacen.limpiar)
      almacen.limpiar()
    }
  }, [almacen])
  return <ContextoBorradores value={almacen}>{children}</ContextoBorradores>
}
