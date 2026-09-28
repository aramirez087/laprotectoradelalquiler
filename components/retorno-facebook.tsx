'use client'

import { useEffect } from 'react'

/** Lee el error que Facebook deja en el fragmento: el servidor no lo recibe. */
export function RetornoFacebook() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    const descripcion =
      url.searchParams.get('error_description') ||
      hash.get('error_description') ||
      url.searchParams.get('error') ||
      hash.get('error') ||
      ''
    const modo = url.searchParams.get('modo') === 'vincular' ? 'vincular' : 'entrar'
    const siguiente = url.searchParams.get('next') ?? '/fichas'
    if (modo === 'vincular') {
      window.location.replace('/perfil?error=facebook')
      return
    }
    const error = /already|registered|exists|duplicate/i.test(descripcion) ? 'facebook-correo' : 'facebook'
    window.location.replace(`/login?${new URLSearchParams({ error, siguiente })}`)
  }, [])

  return null
}
