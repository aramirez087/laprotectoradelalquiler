'use client'

import { useEffect, useState } from 'react'

export type Tema = 'system' | 'light' | 'dark'

const opciones: { valor: Tema; etiqueta: string; trazo: string }[] = [
  { valor: 'light', etiqueta: 'Tema claro', trazo: 'M12 3v1m0 16v1M3 12h1m16 0h1M5.6 5.6l.7.7m11.4 11.4.7.7M5.6 18.4l.7-.7M17.7 6.3l.7-.7M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0' },
  { valor: 'dark', etiqueta: 'Tema oscuro', trazo: 'M20.2 14.2A8.5 8.5 0 0 1 9.8 3.8a8.5 8.5 0 1 0 10.4 10.4Z' },
  { valor: 'system', etiqueta: 'Tema del sistema', trazo: 'M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM9 21h6m-3-4v4' },
]

export function SelectorTema({ inicial }: { inicial: Tema }) {
  const [tema, setTema] = useState(inicial)

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    document.cookie = `protectora-tema=${tema}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    const sistema = window.matchMedia('(prefers-color-scheme: dark)')
    function actualizarColor() {
      const oscuro = tema === 'dark' || (tema === 'system' && sistema.matches)
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        meta.setAttribute('content', oscuro ? '#171a17' : '#faf9f5')
      })
    }
    actualizarColor()
    sistema.addEventListener('change', actualizarColor)
    return () => sistema.removeEventListener('change', actualizarColor)
  }, [tema])

  return (
    <div className="selector-tema" role="group" aria-label="Tema de la interfaz">
      {opciones.map(({ valor, etiqueta, trazo }) => (
        <button
          key={valor}
          type="button"
          className="opcion-tema"
          aria-label={etiqueta}
          title={etiqueta}
          aria-pressed={tema === valor}
          onClick={() => setTema(valor)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={trazo} />
          </svg>
        </button>
      ))}
    </div>
  )
}
