'use client'

import NextLink, { useLinkStatus } from 'next/link'
import type { ComponentProps } from 'react'

function EstadoEnlace() {
  const { pending } = useLinkStatus()
  return <span data-cargando={pending || undefined} className="sr-only">{pending ? 'Abriendo página…' : ''}</span>
}

export default function Enlace({ children, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props}>{children}<EstadoEnlace /></NextLink>
}
