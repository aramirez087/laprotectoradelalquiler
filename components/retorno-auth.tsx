'use client'

import { useEffect, useRef } from 'react'
import { retornoAuth } from '@/lib/retorno-auth'
import { createClient } from '@/lib/supabase/client'

/** Restore legacy email callbacks before the visitor starts another login. */
export function RetornoAuth() {
  const iniciado = useRef(false)
  useEffect(() => {
    if (iniciado.current) return
    const retorno = retornoAuth(window.location.href)
    if (!retorno) return
    iniciado.current = true
    // Remove email credentials from browser history before making any request.
    window.history.replaceState(window.history.state, '', window.location.pathname)
    if (!('accessToken' in retorno)) {
      window.location.replace(retorno.ruta)
      return
    }
    void (async () => {
      try {
        const supabase = createClient({ detectSessionInUrl: false })
        if (!supabase) throw new Error('Auth unavailable')
        const { error } = await supabase.auth.setSession({ access_token: retorno.accessToken, refresh_token: retorno.refreshToken })
        if (error) throw error
        window.location.replace(retorno.ruta)
      } catch {
        window.location.replace('/recuperar?error=enlace')
      }
    })()
  }, [])
  return null
}
