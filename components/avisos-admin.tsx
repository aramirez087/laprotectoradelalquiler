'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { EstadoForm } from '@/lib/actions/auth'
import { borradoresAdmin } from '@/lib/borradores-admin'

type OpcionesAviso = { enfocar?: boolean }
const Contexto = createContext<(resultado: EstadoForm, opciones?: OpcionesAviso) => void>(() => {})

/** Lives above cards so filtering, deletion and reassignment preserve feedback and focus. */
export function AvisosAdmin({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<{ resultado: NonNullable<EstadoForm>; enfocar: boolean }>()
  const panel = useRef<HTMLDivElement>(null)
  const focoAnterior = useRef<HTMLElement | null>(null)
  useEffect(() => () => borradoresAdmin.limpiar(), [])
  function mostrar(estado: EstadoForm, opciones?: OpcionesAviso) {
    if (!estado?.mensaje) return
    if (opciones?.enfocar && document.activeElement instanceof HTMLElement) focoAnterior.current = document.activeElement
    setAviso({ resultado: estado, enfocar: Boolean(opciones?.enfocar) })
  }
  useEffect(() => {
    if (aviso?.enfocar) panel.current?.focus({ preventScroll: true })
  }, [aviso])

  function cerrar() {
    const restaurar = panel.current?.contains(document.activeElement)
    setAviso(undefined)
    if (restaurar) {
      const anterior = focoAnterior.current
      const puedeRestaurar = anterior?.isConnected && anterior !== document.body && anterior !== document.documentElement && !anterior.matches(':disabled')
      const destino = puedeRestaurar ? anterior : document.getElementById('usuarios-resultados') ?? document.getElementById('contenido')
      destino?.focus({ preventScroll: true })
    }
  }

  return (
    <Contexto value={mostrar}>
      {children}
      <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl" aria-live="polite" aria-atomic="true">
        {aviso && (
          <div ref={panel} tabIndex={-1} className={`aviso shadow-lg ${aviso.resultado.advertencia ? 'aviso-error' : 'aviso-ok'}`}>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-48 break-words">
                <p>{aviso.resultado.mensaje}</p>
                {aviso.resultado.advertencia && <p className="mt-2">{aviso.resultado.advertencia}</p>}
              </div>
              <button type="button" onClick={cerrar} className="min-h-11 shrink-0 underline underline-offset-4">Cerrar aviso</button>
            </div>
          </div>
        )}
      </div>
    </Contexto>
  )
}

export function useAvisoAdmin() {
  return useContext(Contexto)
}
