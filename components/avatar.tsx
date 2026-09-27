'use client'

import { useState } from 'react'
import { iniciales, tintaDe, urlImagen } from '@/lib/util'

const TAMANOS = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
} as const

export function Avatar({
  nombre,
  fotoUrl,
  tamano = 'md',
}: {
  nombre: string
  fotoUrl?: string | null
  tamano?: keyof typeof TAMANOS
}) {
  const [rota, setRota] = useState(false)
  const src = rota ? null : urlImagen(fotoUrl)
  const medida = TAMANOS[tamano]

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => setRota(true)}
        className={`${medida} shrink-0 rounded-full object-cover`}
      />
    )
  }

  return (
    <span
      className={`${medida} inline-flex shrink-0 items-center justify-center rounded-full font-medium text-[#f7f7f6]`}
      style={{ background: tintaDe(nombre) }}
      aria-hidden
    >
      {iniciales(nombre || '?')}
    </span>
  )
}
