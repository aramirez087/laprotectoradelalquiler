'use client'

import { useEffect, useState } from 'react'

export type Tema = 'system' | 'light' | 'dark'

export function SelectorTema({ inicial }: { inicial: Tema }) {
  const [tema, setTema] = useState(inicial)

  useEffect(() => {
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

  function cambiar(valor: string) {
    if (valor !== 'system' && valor !== 'light' && valor !== 'dark') return
    document.documentElement.dataset.theme = valor
    document.cookie = `protectora-tema=${valor}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    setTema(valor)
  }

  return (
    <label className="selector-tema" title="Tema de la interfaz">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
      </svg>
      <span className="sr-only">Tema de la interfaz</span>
      <select value={tema} onChange={(event) => cambiar(event.target.value)}>
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
  )
}
