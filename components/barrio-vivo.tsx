'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import styles from './barrio-vivo.module.css'

const imagen = {
  src: '/images/barrio.webp',
  width: 1000,
  height: 500,
  sizes: '(max-width: 373px) 75vw, (max-width: 639px) 280px, 336px',
} as const

/** A little depth for the original watercolor; the page itself stays still. */
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
    let x = 0
    let y = 0
    let destinoX = 0
    let destinoY = 0

    function dibujar() {
      elemento!.style.setProperty('--barrio-x', x.toFixed(4))
      elemento!.style.setProperty('--barrio-y', y.toFixed(4))
    }

    function detener() {
      cancelAnimationFrame(frame)
      frame = 0
      anterior = 0
      x = y = destinoX = destinoY = 0
      dibujar()
    }

    function animar(ahora: number) {
      // Time-based easing feels the same on 60 Hz and high-refresh displays.
      const paso = 1 - Math.exp(-Math.min(ahora - (anterior || ahora - 16), 64) / 130)
      anterior = ahora
      x += (destinoX - x) * paso
      y += (destinoY - y) * paso

      if (Math.abs(destinoX - x) + Math.abs(destinoY - y) < 0.001) {
        x = destinoX
        y = destinoY
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
      destinoX = Math.max(-1, Math.min(1, (evento.clientX - limites.left - limites.width / 2) / 420))
      destinoY = Math.max(-1, Math.min(1, (evento.clientY - limites.top - limites.height / 2) / 360))
      iniciar()
    }

    function volver() {
      destinoX = destinoY = 0
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
    window.addEventListener('blur', detener)
    document.addEventListener('visibilitychange', detener)
    movimiento.addEventListener('change', detener)

    return () => {
      detener()
      observador.disconnect()
      inicio.removeEventListener('pointermove', seguir)
      inicio.removeEventListener('pointerleave', volver)
      window.removeEventListener('blur', detener)
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
          <Image {...imagen} alt="" loading="eager" className={styles.ilustracion} draggable={false} />
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
