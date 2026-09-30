'use client'

import { useEffect, useId, useRef } from 'react'

/** One navigation confirmation covers all unsaved forms on the current page. */
export function ProtectorEdicionAdmin({ pendiente, nombre }: { pendiente: boolean; nombre: string }) {
  const id = useId()
  const dialogo = useRef<HTMLDialogElement>(null)
  const destino = useRef<string | null>(null)
  const descartar = useRef(false)

  useEffect(() => {
    if (!pendiente) return
    const alDescartar = () => { descartar.current = true }
    const alSalir = (event: BeforeUnloadEvent) => {
      if (!descartar.current) { event.preventDefault(); event.returnValue = '' }
    }
    const alNavegar = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const enlace = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!enlace || enlace.target === '_blank' || enlace.hasAttribute('download')) return
      const url = new URL(enlace.href)
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return
      event.preventDefault()
      event.stopPropagation()
      destino.current = enlace.href
      dialogo.current?.showModal()
    }
    window.addEventListener('beforeunload', alSalir)
    window.addEventListener('admin-descartar-ediciones', alDescartar)
    document.addEventListener('click', alNavegar, true)
    return () => {
      window.removeEventListener('beforeunload', alSalir)
      window.removeEventListener('admin-descartar-ediciones', alDescartar)
      document.removeEventListener('click', alNavegar, true)
    }
  }, [pendiente])

  return <dialog ref={dialogo} className="dialogo-admin" aria-labelledby={`${id}-titulo`} aria-describedby={`${id}-ayuda`}>
    <h2 id={`${id}-titulo`} className="text-2xl">Tiene cambios sin guardar</h2>
    <p id={`${id}-ayuda`} className="my-5 text-sm leading-6 text-ink-soft">Si continúa, se descartarán las ediciones sin guardar de {nombre} en esta página.</p>
    <div className="flex flex-wrap justify-end gap-3">
      <button type="button" className="btn-secundario" onClick={() => dialogo.current?.close()}>Seguir editando</button>
      <button type="button" className="btn-secundario btn-peligro" onClick={() => {
        if (destino.current) {
          window.dispatchEvent(new Event('admin-descartar-ediciones'))
          window.location.assign(destino.current)
        }
      }}>Descartar y continuar</button>
    </div>
  </dialog>
}
