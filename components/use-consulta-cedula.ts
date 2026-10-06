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
    let cancelada = false
    const temporizador = setTimeout(async () => {
      setRespuesta({ clave, resultado: { estado: 'pendiente' } })
      const limite = setTimeout(() => controller.abort(), 15_000)
      try {
        const respuesta = await fetch('/api/cedula', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cedula: clave }),
          signal: controller.signal, cache: 'no-store',
        })
        const resultado: ConsultaEnCurso = respuesta.status === 429
          ? { estado: 'limite' }
          : respuesta.ok ? await respuesta.json() as ResultadoCedula : { estado: 'no_disponible' }
        if (controller.signal.aborted) return
        setRespuesta({ clave, resultado })
        if (resultado.estado === 'encontrada' && resultado.persona.identificacion === clave) alEncontrar(resultado.persona)
      } catch {
        if (!cancelada) setRespuesta({ clave, resultado: { estado: 'no_disponible' } })
      } finally {
        clearTimeout(limite)
      }
    }, 450)
    return () => { cancelada = true; clearTimeout(temporizador); controller.abort() }
  }, [clave, alEncontrar])
  if (!cedula.trim()) return { estado: 'incompleta' } as const
  if (/^[\d\s-]+$/.test(cedula.trim()) && cedula.replace(/[\s-]/g, '').length < 9) return { estado: 'incompleta' } as const
  if (!clave) return { estado: 'no_aplica' } as const
  return respuesta?.clave === clave ? respuesta.resultado : { estado: 'pendiente' } as const
}
