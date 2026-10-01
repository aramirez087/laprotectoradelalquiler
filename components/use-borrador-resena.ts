'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { guardarBorradorResena } from '@/lib/actions/borrador-resena'
import { datosBorrador, type EstadoBorrador } from '@/lib/borrador-resena'

export function useBorradorResena(inicial: EstadoBorrador | undefined, personaId: number | null, form: RefObject<HTMLFormElement | null>) {
  const version = useRef(inicial?.version ?? null)
  const ultimo = useRef(inicial?.datos ? JSON.stringify(inicial.datos) : '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const guardando = useRef(false)
  const detenido = useRef(false)
  const montado = useRef(true)
  const [estado, setEstado] = useState<'listo' | 'cambios' | 'guardando' | 'guardado' | 'error' | 'conflicto'>(inicial?.datos ? 'guardado' : 'listo')
  const [error, setError] = useState('')
  const guardarRef = useRef<() => Promise<void>>(async () => {})
  const disponible = inicial?.disponible === true

  const guardar = useCallback(async () => {
    if (!disponible || !form.current || guardando.current || detenido.current) return
    const datos = datosBorrador(form.current)
    const contenido = JSON.stringify(datos)
    if (contenido === ultimo.current) { setEstado('guardado'); return }
    guardando.current = true
    setEstado('guardando')
    try {
      const resultado = await guardarBorradorResena({ personaId, version: version.current, datos })
      if (resultado.version) { version.current = resultado.version; ultimo.current = contenido }
      if (!montado.current || detenido.current) return
      if (resultado.error) {
        detenido.current = resultado.conflicto === true
        setError(resultado.error)
        setEstado(resultado.conflicto ? 'conflicto' : 'error')
      } else if (form.current && JSON.stringify(datosBorrador(form.current)) !== contenido) {
        setEstado('cambios')
        timer.current = setTimeout(() => void guardarRef.current(), 1200)
      } else { setError(''); setEstado('guardado') }
    } catch {
      if (montado.current && !detenido.current) {
        setError('No pudimos confirmar el guardado. Sus datos siguen en esta página. Intente guardar antes de salir.')
        setEstado('error')
      }
    } finally { guardando.current = false }
  }, [disponible, personaId, form])

  useEffect(() => { guardarRef.current = guardar }, [guardar])
  useEffect(() => {
    montado.current = true
    return () => { montado.current = false; if (timer.current) clearTimeout(timer.current) }
  }, [])

  const cambio = useCallback(() => {
    if (detenido.current) return
    if (timer.current) clearTimeout(timer.current)
    setEstado('cambios')
    if (disponible) timer.current = setTimeout(() => void guardarRef.current(), 1200)
  }, [disponible])

  function pausar() {
    detenido.current = true
    if (timer.current) clearTimeout(timer.current)
  }
  function continuar() { if (estado !== 'conflicto') { detenido.current = false; cambio() } }

  return { disponible, estado, error, cambio, guardar, pausar, continuar }
}
