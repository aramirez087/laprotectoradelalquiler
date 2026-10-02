'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import styles from './barrio-vivo.module.css'

const imagen = {
  src: '/images/barrio.webp',
  width: 1000,
  height: 500,
  sizes: '(max-width: 639px) and (max-height: 740px) 192px, (max-width: 639px) min(32svh, 280px), 336px',
} as const

/** The sun and moon follow a quiet arc above the fixed neighborhood. */
export function BarrioVivo() {
  const escena = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const elemento = escena.current
    const inicio = elemento?.closest<HTMLElement>('.inicio')
    if (!elemento || !inicio) return

    const movimiento = window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)')
    let visible = false
    let frame = 0
    let anterior = 0
    // A circular path centered below the neighborhood, preserving the artwork's
    // resting position. Smooth the angle so even reversals stay on the arc.
    const inclinacion = -18 * Math.PI / 180
    const recorrido = 14 * Math.PI / 180
    const velocidadMaxima = 4 * Math.PI / 180 // At most four degrees per second.
    const radio = 45 // Percentage of the illustration's width.
    let angulo = 0
    let destino = 0
    let velocidad = 0

    function dibujar() {
      const actual = inclinacion + angulo
      const x = radio * (Math.sin(actual) - Math.sin(inclinacion))
      // The artwork is twice as wide as it is tall: keep the radius circular.
      const y = radio * 2 * (Math.cos(inclinacion) - Math.cos(actual))
      elemento!.style.setProperty('--orbita-x', `${x.toFixed(4)}%`)
      elemento!.style.setProperty('--orbita-y', `${y.toFixed(4)}%`)
    }

    function pausar() {
      cancelAnimationFrame(frame)
      frame = 0
      anterior = 0
      velocidad = 0
      destino = angulo
    }

    function detener() {
      pausar()
      angulo = destino = velocidad = 0
      dibujar()
    }

    function animar(ahora: number) {
      // Ease velocity as well as position: quick pointer changes cannot make
      // the sun jump or reverse abruptly. The speed cap applies on every frame.
      const segundos = Math.min(ahora - (anterior || ahora - 16), 64) / 1000
      anterior = ahora
      const deseada = Math.max(-velocidadMaxima, Math.min(velocidadMaxima, destino - angulo))
      velocidad += (deseada - velocidad) * (1 - Math.exp(-segundos / 0.25))
      angulo += velocidad * segundos

      if (Math.abs(destino - angulo) < 0.0001 && Math.abs(velocidad) < 0.0001) {
        angulo = destino
        velocidad = 0
        frame = 0
        anterior = 0
      } else {
        frame = requestAnimationFrame(animar)
      }
      dibujar()
    }

    function iniciar() {
      if (!frame) frame = requestAnimationFrame(animar)
    }

    function seguir(evento: PointerEvent) {
      if (!visible || !movimiento.matches || document.hidden || evento.pointerType !== 'mouse') return
      const limites = elemento!.getBoundingClientRect()
      const posicion = Math.max(-1, Math.min(1, (evento.clientX - limites.left - limites.width / 2) / 420))
      destino = posicion * recorrido
      iniciar()
    }

    function volver() {
      destino = 0
      if (movimiento.matches && visible && !document.hidden) iniciar()
      else detener()
    }

    const observador = new IntersectionObserver(([entrada]) => {
      visible = entrada.isIntersecting
      if (!visible) detener()
    })
    observador.observe(elemento)
    inicio.addEventListener('pointermove', seguir, { passive: true })
    inicio.addEventListener('pointerleave', volver)
    window.addEventListener('blur', pausar)
    document.addEventListener('visibilitychange', detener)
    movimiento.addEventListener('change', detener)

    return () => {
      detener()
      observador.disconnect()
      inicio.removeEventListener('pointermove', seguir)
      inicio.removeEventListener('pointerleave', volver)
      window.removeEventListener('blur', pausar)
      document.removeEventListener('visibilitychange', detener)
      movimiento.removeEventListener('change', detener)
    }
  }, [])

  return (
    <div ref={escena} className={styles.escena} aria-hidden="true">
      <div className={styles.entrada}>
        <div className={styles.cielo}>
          <span className={styles.aureola} />
          {/* Both layers reuse the same optimized image request. */}
          <Image {...imagen} alt="" loading="eager" className={styles.sol} draggable={false} />
        </div>
        <div className={styles.casas}>
          <Image {...imagen} alt="" loading="eager" fetchPriority="high" className={styles.ilustracion} draggable={false} />
          <svg className={styles.ventanas} viewBox="0 0 1000 500" fill="currentColor" focusable="false">
            {/* Inset panes preserve the watercolor frames and window boxes. */}
            <g className={styles.ventanaUno}>
              <path d="M270 312h7v17h-7z M280 312h7v17h-7z M270 333h7v9h-7z M280 333h7v9h-7z" />
            </g>
            <g className={styles.ventanaDos}>
              <path d="M554 290h8v12h-8z M568 290h9v12h-9z M554 306h8v12h-8z M568 306h9v12h-9z" />
            </g>
            <g className={styles.ventanaTres}>
              <path d="m794 345 6 1v9l-6-1z m10 1 6 1v9l-6-1z m-10 11 6 1v8l-6-1z m10 1 6 1v8l-6-1z" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}
