'use client'

import ErrorPagina from './error'
import { useEffect } from 'react'
import './globals.css'

export default function ErrorGlobal(props: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    const guardado = document.cookie.match(/(?:^|;\s*)protectora-tema=(light|dark)(?:;|$)/)?.[1]
    if (guardado) document.documentElement.dataset.theme = guardado
  }, [])
  return <html lang="es-CR"><body className="min-h-screen" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
    <title>No pudimos cargar el sitio · La Protectora del Alquiler</title>
    <main id="contenido"><ErrorPagina {...props} /></main>
  </body></html>
}
