'use client'

import { useFormStatus } from 'react-dom'

export function BotonSalir({ className, children }: { className: string; children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return <button type="submit" className={className} disabled={pending} aria-busy={pending}>
    {pending ? 'Saliendo…' : children}
  </button>
}
