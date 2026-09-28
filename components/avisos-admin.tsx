'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { EstadoForm } from '@/lib/actions/auth'

const Contexto = createContext<(resultado: EstadoForm) => void>(() => {})

/** Lives above review cards so deletion/reassignment does not swallow feedback. */
export function AvisosAdmin({ children }: { children: ReactNode }) {
  const [resultado, setResultado] = useState<EstadoForm>()
  function mostrar(estado: EstadoForm) {
    if (estado?.mensaje) setResultado(estado)
  }

  return (
    <Contexto value={mostrar}>
      {children}
      <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl" aria-live="polite" aria-atomic="true">
        {resultado && (
          <div className={`aviso shadow-lg ${resultado.advertencia ? 'aviso-error' : 'aviso-ok'}`}>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-48 break-words">
                <p>{resultado.mensaje}</p>
                {resultado.advertencia && <p className="mt-2">{resultado.advertencia}</p>}
              </div>
              <button type="button" onClick={() => setResultado(undefined)} className="min-h-11 shrink-0 underline underline-offset-4">Cerrar aviso</button>
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
