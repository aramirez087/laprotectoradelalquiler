'use client'

import { useEffect } from 'react'
import { registrarPrimeraConsultaAction } from '@/lib/actions/activacion'

export function PrimeraConsulta({ confirmacion }: { confirmacion: string }) {
  useEffect(() => {
    const privacidad = navigator as Navigator & { globalPrivacyControl?: boolean }
    if (privacidad.doNotTrack === '1' || privacidad.globalPrivacyControl) return
    void registrarPrimeraConsultaAction(confirmacion).catch(() => {})
  }, [confirmacion])
  return null
}
