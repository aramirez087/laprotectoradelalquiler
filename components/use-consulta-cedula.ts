'use client'

import { useEffect, useState } from 'react'
import { cedulaNacional, type NombrePadron, type ResultadoCedula } from '@/lib/cedula'
import type { ConsultaEnCurso } from '@/components/estado-cedula'

export function useConsultaCedula(cedula: string, alEncontrar: (persona: NombrePadron) => void) {
  const clave = cedulaNacional(cedula)
  const [respuesta, setRespuesta] = useState<{ clave: string; resultado: ConsultaEnCurso } | null>(null)
  useEffect(() => {
    if (!clave) return
    const controller = new AbortController()
    const temporizador = setTimeout(async () => {
      setRespuesta({ clave, resultado: { estado: 'pendiente' } })
      try {
        const respuesta = await fetch('/api/cedula', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cedula: clave }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]), cache: 'no-store',
        })
        const resultado: ConsultaEnCurso = respuesta.status === 429
          ? { estado: 'limite' }
          : respuesta.ok ? await respuesta.json() as ResultadoCedula : { estado: 'no_disponible' }
        if (controller.signal.aborted) return
        setRespuesta({ clave, resultado })
        if (resultado.estado === 'encontrada' && resultado.persona.identificacion === clave) alEncontrar(resultado.persona)
      } catch {
        if (!controller.signal.aborted) setRespuesta({ clave, resultado: { estado: 'no_disponible' } })
      }
    }, 450)
    return () => { clearTimeout(temporizador); controller.abort() }
  }, [clave, alEncontrar])
  if (!cedula.trim()) return { estado: 'incompleta' } as const
  if (/^[\d\s-]+$/.test(cedula.trim()) && cedula.replace(/[\s-]/g, '').length < 9) return { estado: 'incompleta' } as const
  if (!clave) return { estado: 'no_aplica' } as const
  return respuesta?.clave === clave ? respuesta.resultado : { estado: 'pendiente' } as const
}
