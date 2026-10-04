'use client'

import { useState } from 'react'

export function CampoClave({
  id,
  name,
  autoComplete,
  describedBy,
  readOnly = false,
}: {
  id: string
  name: string
  autoComplete: string
  describedBy?: string
  readOnly?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        required
        readOnly={readOnly}
        minLength={autoComplete === 'new-password' ? 8 : undefined}
        pattern={autoComplete === 'new-password' ? '(?=.*[a-zA-Z])(?=.*[0-9]).{8,}' : undefined}
        title={autoComplete === 'new-password' ? 'Al menos 8 caracteres, con letras y números.' : undefined}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-describedby={describedBy}
        className="campo pr-24"
      />
      <button
        type="button"
        className="absolute inset-y-0 right-1 min-h-11 min-w-16 rounded-lg px-3 text-xs font-semibold text-seal hover:bg-seal-soft"
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${id === 'confirmacion' ? 'confirmación de clave' : 'clave'}`}
        aria-controls={id}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  )
}
