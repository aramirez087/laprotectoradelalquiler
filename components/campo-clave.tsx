'use client'

import { useState } from 'react'

export function CampoClave({
  id,
  name,
  autoComplete,
  describedBy,
}: {
  id: string
  name: string
  autoComplete: string
  describedBy?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        required
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        className="campo pr-24"
      />
      <button
        type="button"
        className="absolute inset-y-1 right-1 rounded-full px-3 text-xs font-bold text-ink-soft"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  )
}
