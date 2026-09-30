'use client'

import Form from 'next/form'
import { useFormStatus } from 'react-dom'
import type { ComponentProps } from 'react'

function EstadoBusqueda() {
  const { pending } = useFormStatus()
  return <span data-cargando={pending || undefined} className="sr-only" role="status">{pending ? 'Buscando resultados…' : ''}</span>
}

export function FormularioBusqueda({ children, ...props }: ComponentProps<typeof Form>) {
  return <Form {...props}>{children}<EstadoBusqueda /></Form>
}
