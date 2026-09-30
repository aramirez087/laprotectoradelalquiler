'use client'

import { useEffect, useState } from 'react'

export function AvisoErrorCliente() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const mostrar = () => setVisible(true)
    window.addEventListener('protectora:error-cliente', mostrar)
    return () => window.removeEventListener('protectora:error-cliente', mostrar)
  }, [])
  if (!visible) return null
  return <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl aviso aviso-error" role="alert">
    <p>No pudimos completar una operación. Puede volver a intentarlo. Si continúa, recargue la página.</p>
    <p className="mt-2 text-xs">Copie los datos que aún no haya guardado antes de recargar.</p>
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" onClick={() => window.location.reload()} className="btn-secundario">Recargar página</button>
      <button type="button" onClick={() => setVisible(false)} className="enlace-texto">Cerrar aviso</button>
    </div>
  </div>
}
