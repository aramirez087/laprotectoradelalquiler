'use client'

import { useRef, type FormEvent } from 'react'
import Link from 'next/link'
import { cancelarInvitacionAdminAction } from '@/lib/actions/invitaciones'
import type { FilaInvitacionAdmin } from '@/lib/invitaciones-admin'
import { useFormAction } from '@/components/use-form-action'
import { useAvisoAdmin } from '@/components/avisos-admin'
import { MensajeForm } from '@/components/mensaje-form'
import { Paginacion } from '@/components/paginacion'

const ESTADOS = { pendiente: 'Pendiente', aceptada: 'Aceptada', vencida: 'Vencida', revocada: 'Revocada' } as const

function fecha(valor: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Costa_Rica' }).format(new Date(valor))
}

function CancelarInvitacion({ invitacion }: { invitacion: FilaInvitacionAdmin }) {
  const mostrar = useAvisoAdmin()
  const { estado, pendiente, formProps } = useFormAction(cancelarInvitacionAdminAction.bind(null, invitacion.id), {
    onResultado: (resultado) => {
      if (resultado?.mensaje) mostrar({ ...resultado, mensaje: `Se revocó la invitación para ${invitacion.email}.` }, { enfocar: true })
    },
  })
  const dialogo = useRef<HTMLDialogElement>(null)
  const confirmado = useRef(false)
  function enviar(event: FormEvent<HTMLFormElement>) {
    if (!confirmado.current) { event.preventDefault(); dialogo.current?.showModal(); return }
    confirmado.current = false
    formProps.onSubmit(event)
  }
  return (
    <>
      <form {...formProps} onSubmit={enviar}>
        <input type="hidden" name="confirmar" value="1" />
        <button disabled={pendiente} className="btn-secundario btn-peligro" aria-label={`Revocar invitación de ${invitacion.nombre}`}>{pendiente ? 'Revocando…' : 'Revocar'}</button>
        <MensajeForm error={estado?.error} />
      </form>
      <dialog ref={dialogo} className="dialogo-admin" aria-labelledby={`revocar-${invitacion.id}`} aria-describedby={`revocar-ayuda-${invitacion.id}`}>
        <h2 id={`revocar-${invitacion.id}`} className="text-2xl">Revocar invitación</h2>
        <p id={`revocar-ayuda-${invitacion.id}`} className="my-5 break-words text-sm leading-6 text-ink-soft">El enlace enviado a <strong className="text-ink">{invitacion.nombre} ({invitacion.email})</strong> dejará de funcionar. Podrá generar una nueva invitación después.</p>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn-secundario" onClick={() => dialogo.current?.close()}>Conservar invitación</button>
          <button type="button" className="btn-secundario btn-peligro" onClick={() => { confirmado.current = true; dialogo.current?.close(); formProps.ref.current?.requestSubmit() }}>Confirmar revocación</button>
        </div>
      </dialog>
    </>
  )
}

export function InvitacionesAdmin({ filas, total, pagina, porPagina, hrefBase }: { filas: FilaInvitacionAdmin[]; total: number; pagina: number; porPagina: number; hrefBase: string }) {
  function href(params: Record<string, string>) {
    const [ruta, busqueda = ''] = hrefBase.split('?')
    const query = new URLSearchParams(busqueda)
    for (const [clave, valor] of Object.entries(params)) query.set(clave, valor)
    return `${ruta}?${query}#invitaciones`
  }
  if (!total) return <p className="py-4 text-sm text-ink-soft">Todavía no se han creado invitaciones. Las nuevas aparecerán aquí para consultar su estado, renovarlas o revocarlas.</p>
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">Las horas se muestran en la zona de Costa Rica. Un enlace puede vencer antes del plazo máximo según la configuración de autenticación.</p>
      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {filas.map((invitacion) => (
          <li key={invitacion.id} className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-medium">{invitacion.nombre}</h3>
                <p className="mt-1 break-all text-sm text-ink-soft">{invitacion.email}</p>
                <p className="mt-1 text-xs text-ink-soft">{invitacion.proposito === 'acceso' ? 'Inicio de sesión · conserva su rol' : 'Permisos de administración'}</p>
              </div>
              <span className={`chip ${invitacion.estado === 'aceptada' ? 'chip-ok' : invitacion.estado === 'vencida' || invitacion.estado === 'revocada' ? 'chip-alerta' : ''}`}>{ESTADOS[invitacion.estado]}</span>
            </div>
            <dl className="grid gap-3 text-xs sm:grid-cols-3">
              <div><dt className="font-semibold text-ink-soft">Creada por</dt><dd className="mt-1 break-words">{invitacion.invitador_nombre ?? 'Administración'} · <time dateTime={invitacion.creado_en}>{fecha(invitacion.creado_en)}</time></dd></div>
              <div><dt className="font-semibold text-ink-soft">{invitacion.aceptada_en ? 'Aceptada' : invitacion.revocada_en ? 'Revocada' : 'Vencimiento máximo'}</dt><dd className="mt-1"><time dateTime={invitacion.aceptada_en ?? invitacion.revocada_en ?? invitacion.vence_en}>{fecha(invitacion.aceptada_en ?? invitacion.revocada_en ?? invitacion.vence_en)}</time></dd></div>
              <div><dt className="font-semibold text-ink-soft">Entrega</dt><dd className="mt-1">{invitacion.error_envio_en ? 'Envío por correo sin confirmar' : invitacion.enviada_en ? 'Enviada por correo' : 'Enlace para compartir'}</dd></div>
            </dl>
            {invitacion.estado !== 'aceptada' && <div className="flex flex-wrap gap-2">
              <Link href={href({ renovarInvitacion: invitacion.id, proposito: invitacion.proposito })} className="btn-secundario" aria-label={`Renovar invitación de ${invitacion.nombre}`}>Renovar enlace</Link>
              {invitacion.estado === 'pendiente' && <CancelarInvitacion invitacion={invitacion} />}
            </div>}
          </li>
        ))}
      </ul>
      <Paginacion pagina={pagina} paginas={Math.ceil(total / porPagina)} href={(n) => href({ paginaInvitaciones: String(n) })} />
    </div>
  )
}
