'use client'

import { useFormAction } from '@/components/use-form-action'
import { useAvisoAdmin } from '@/components/avisos-admin'
import { decidirResenaAction, editarResenaAction, eliminarResenaAction, guardarUsuarioAction, resolverDenunciaAction } from '@/lib/actions/admin'
import { CamposIdentidad } from '@/components/campos-identidad'
import { MensajeForm } from '@/components/mensaje-form'
import { etiquetaRol } from '@/lib/util'
import type { Rol } from '@/lib/tipos'
import { useRef, type FormEvent } from 'react'
import { useBorradorAdmin } from '@/components/use-borrador-admin'
import { ProtectorEdicionAdmin } from '@/components/protector-edicion-admin'

const DECISIONES = {
  publicar: 'Aprobar y publicar',
  corregir: 'Solicitar correcciones',
  rechazar: 'Rechazar reseña',
  revisar: 'Devolver a revisión',
} as const

export function FormDecision({
  id,
  version,
  decisiones,
  nota,
  notificacionesHabilitadas = false,
}: {
  id: number
  version: number
  decisiones: Array<keyof typeof DECISIONES>
  nota?: string | null
  notificacionesHabilitadas?: boolean
}) {
  const onResultado = useAvisoAdmin()
  const { estado, pendiente, formProps } = useFormAction(decidirResenaAction, { onResultado })

  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <div>
        <label className="etiqueta-campo" htmlFor={`nota-${id}`}>
          Motivo o nota para el autor
        </label>
        <textarea id={`nota-${id}`} name="nota" rows={2} maxLength={2000} defaultValue={nota ?? ''} className="campo" placeholder="Explique la decisión para que el autor sepa qué hacer."
          aria-invalid={!!estado?.campos?.nota} aria-describedby={`ayuda-nota-${id}${estado?.campos?.nota ? ` error-nota-${id}` : ''}`} />
        <p id={`ayuda-nota-${id}`} className="mt-2 text-xs text-ink-soft">Obligatorio al solicitar correcciones. Autoriza cambios en el relato o el anonimato y un nuevo envío. Corregir la identidad del inquilino corresponde a administración. «Rechazar reseña» impide el reenvío.</p>
        <ErrorCampo nombre={`nota-${id}`} mensaje={estado?.campos?.nota} />
      </div>
      <p className="text-xs text-ink-soft">Las aprobaciones, solicitudes de corrección y rechazos generan un aviso automático al autor.
        {!notificacionesHabilitadas && ' El correo aún no está configurado; los avisos quedarán pendientes.'}</p>
      <MensajeForm error={estado?.error} />
      <div className="flex flex-wrap gap-2">
        {decisiones.map((decision) => (
          <button key={decision} name="decision" value={decision} disabled={pendiente} className={decision === 'publicar' ? 'btn-primario' : decision === 'rechazar' ? 'btn-secundario btn-peligro' : 'btn-secundario'}>
            {DECISIONES[decision]}
          </button>
        ))}
      </div>
      {pendiente && <p role="status" className="text-sm text-ink-soft">Guardando decisión…</p>}
    </form>
  )
}

function ErrorCampo({ nombre, mensaje }: { nombre: string; mensaje?: string }) {
  return mensaje ? (
    <p id={`error-${nombre}`} className="mt-2 text-sm text-alerta">
      {mensaje}
    </p>
  ) : null
}

function OpcionNotificar({ id, habilitada, soloAprobacion = false }: { id: string; habilitada: boolean; soloAprobacion?: boolean }) {
  return (
    <div className={habilitada ? '' : 'text-ink-soft'}>
      <label htmlFor={id} className={`flex min-h-11 items-start gap-3 py-2 text-sm ${habilitada ? '' : 'opacity-60'}`}>
        <input id={id} name="notificar" type="checkbox" value="1" defaultChecked={habilitada} disabled={!habilitada}
          aria-describedby={`${id}-ayuda`} className="mt-1 h-4 w-4 shrink-0" />
        <span>{soloAprobacion ? 'Avisar al autor cuando se apruebe la reseña' : 'Notificar por correo a quien escribió la reseña'}</span>
      </label>
      <p id={`${id}-ayuda`} className="mt-2 text-xs text-ink-soft">
        {habilitada
          ? soloAprobacion ? 'El aviso se envía al aprobar y publicar. Puede desmarcarlo para esta acción.' : 'El aviso se envía después de guardar. Puede desmarcarlo para esta acción.'
          : 'El envío de correos aún no está configurado. Puede guardar la acción sin enviar una notificación.'}
      </p>
    </div>
  )
}

export function FormEditarResena({
  id,
  version,
  persona,
  comentario,
  anonima,
  notificacionesHabilitadas = false,
}: {
  id: number
  version: number
  persona: {
    identificacion: string
    nombre: string
    nombre2: string | null
    apellido1: string
    apellido2: string | null
  }
  comentario: string | null
  anonima: boolean
  notificacionesHabilitadas?: boolean
}) {
  const onResultado = useAvisoAdmin()
  const { estado, pendiente, formProps } = useFormAction(editarResenaAction, { onResultado })
  function errorCampo(nombre: string) {
    return estado?.campos?.[nombre]
  }

  return (
    <details className="denuncia">
      <summary>Modificar reseña</summary>
      <form {...formProps} className="space-y-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={version} />
        <p className="text-sm text-ink-soft">
          Corregir el nombre actualiza al inquilino en todas sus reseñas. Una cédula distinta mueve solo esta reseña.
        </p>
        <fieldset key={JSON.stringify([persona.identificacion, persona.nombre, persona.nombre2, persona.apellido1, persona.apellido2])} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <CamposIdentidad consultarPadron={false} idBase={`resena-${id}-`} inicial={{ ...persona, nombre2: persona.nombre2 ?? '', apellido2: persona.apellido2 ?? '' }} errores={estado?.campos} />
          </div>
        </fieldset>
        <div>
          <label className="etiqueta-campo" htmlFor={`comentario-${id}`}>
            Relato
          </label>
          <textarea
            id={`comentario-${id}`}
            name="comentario"
            required
            rows={6}
            maxLength={5000}
            defaultValue={comentario ?? ''}
            aria-invalid={!!errorCampo('comentario')}
            aria-describedby={errorCampo('comentario') ? `error-comentario-${id}` : undefined}
            className="campo"
          />
          <ErrorCampo nombre={`comentario-${id}`} mensaje={errorCampo('comentario')} />
        </div>
        <label htmlFor={`anonima-${id}`} className="flex min-h-11 items-start gap-3 py-2 text-sm">
          <input id={`anonima-${id}`} name="anonima" type="checkbox" value="1" defaultChecked={anonima} className="mt-1 h-4 w-4 shrink-0" />
          <span>Ocultar el nombre de quien escribió</span>
        </label>
        <OpcionNotificar id={`notificar-edicion-${id}`} habilitada={notificacionesHabilitadas} />
        <MensajeForm error={estado?.error} />
        <button disabled={pendiente} className="btn-primario">
          {pendiente ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </details>
  )
}

export function FormEliminarResena({ id, notificacionesHabilitadas = false }: { id: number; notificacionesHabilitadas?: boolean }) {
  const onResultado = useAvisoAdmin()
  const { estado, pendiente, formProps } = useFormAction(eliminarResenaAction, { onResultado })

  return (
    <details className="denuncia">
      <summary>Eliminar reseña</summary>
      <form {...formProps} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <p className="text-sm text-ink-soft">Se borra esta reseña del registro. No se puede recuperar.</p>
        <OpcionNotificar id={`notificar-eliminacion-${id}`} habilitada={notificacionesHabilitadas} />
        <MensajeForm error={estado?.error} />
        <button name="confirmar" value="1" disabled={pendiente} className="btn-secundario btn-peligro">
          {pendiente ? 'Eliminando…' : 'Confirmar eliminación'}
        </button>
      </form>
    </details>
  )
}

export function FormUsuario({ id, nombre, rol, activo, version }: {
  id: number
  nombre: string
  rol: Rol
  activo: boolean
  version: string
}) {
  const onResultado = useAvisoAdmin()
  const { estado, pendiente, formProps } = useFormAction(guardarUsuarioAction, {
    onResultado: (resultado) => {
      if (resultado?.mensaje) {
        limpiarBorrador()
        setBorrador((anterior) => ({ ...anterior, guardado: true }))
        onResultado({ ...resultado, mensaje: `Se actualizó la cuenta de ${nombre}.` }, { enfocar: true })
      }
    },
  })
  const actuales = { version, rol, activo, rolOriginal: rol, activoOriginal: activo, guardado: false }
  const [borrador, setBorrador, limpiarBorrador] = useBorradorAdmin(`permisos:${id}`, actuales, (valor) => !valor.guardado && (valor.rol !== valor.rolOriginal || valor.activo !== valor.activoOriginal))
  const borradorModificado = borrador.rol !== borrador.rolOriginal || borrador.activo !== borrador.activoOriginal
  const valores = borrador.guardado || (!borradorModificado && borrador.version !== version) ? actuales : borrador
  const hayCambios = valores.rol !== valores.rolOriginal || valores.activo !== valores.activoOriginal
  const versionCambio = hayCambios && valores.version !== version
  const dialogo = useRef<HTMLDialogElement>(null)
  const confirmado = useRef(false)
  const roles: Rol[] = ['propietario', 'agencia']
  if (rol === 'admin' || rol === 'inquilino') roles.unshift(rol)


  function enviar(event: FormEvent<HTMLFormElement>) {
    if (!hayCambios || pendiente) { event.preventDefault(); return }
    if (!confirmado.current) {
      event.preventDefault()
      dialogo.current?.showModal()
      return
    }
    confirmado.current = false
    formProps.onSubmit(event)
  }

  function cancelar() {
    setBorrador(actuales)
    const detalles = formProps.ref.current?.closest('details')
    if (detalles) { detalles.open = false; detalles.querySelector('summary')?.focus() }
  }

  return (
    <>
      <form {...formProps} onSubmit={enviar} className="space-y-4" aria-label={`Editar permisos de ${nombre}`}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={valores.version} />
        <fieldset disabled={pendiente} className="space-y-4">
          <legend className="sr-only">Permisos de {nombre}</legend>
          {versionCambio && <div className="aviso aviso-error" role="alert" tabIndex={-1}><p>Otra persona modificó esta cuenta. Cargue sus permisos actuales antes de continuar.</p><button type="button" className="enlace-texto" onClick={() => setBorrador(actuales)}>Cargar versión actual</button></div>}
          <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,20rem)_auto] sm:justify-start">
            <div className="min-w-0">
              <label className="etiqueta-campo" htmlFor={`rol-${id}`}>Rol de la cuenta</label>
              <select id={`rol-${id}`} name="rol" value={valores.rol} onChange={(event) => setBorrador({ ...valores, rol: event.target.value as Rol })} required className="campo" aria-describedby={`rol-ayuda-${id}`}>
                {roles.map((opcion) => <option key={opcion} value={opcion}>{etiquetaRol(opcion)}{opcion === 'inquilino' ? ' · histórico' : ''}</option>)}
              </select>
            </div>
            <label className="flex min-h-12 items-center gap-3 text-sm">
              <input type="checkbox" name="activo" checked={valores.activo} onChange={(event) => setBorrador({ ...valores, activo: event.target.checked })} className="h-4 w-4" />
              Cuenta activa
            </label>
          </div>
          <p id={`rol-ayuda-${id}`} className="text-sm leading-6 text-ink-soft">Una cuenta inactiva no puede usar funciones que requieren acceso. Para conceder administración, envíe una invitación y espere su aceptación.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={pendiente || !hayCambios || versionCambio} className="btn-primario">{pendiente ? 'Guardando…' : 'Revisar cambios'}</button>
            <button type="button" onClick={cancelar} className="btn-secundario">Cancelar edición</button>
            <p aria-live="polite" className="text-sm text-ink-soft">{pendiente ? 'Guardando los permisos…' : hayCambios ? 'Tiene cambios sin guardar.' : 'Sin cambios pendientes.'}</p>
          </div>
        </fieldset>
        <MensajeForm error={estado?.error} />
      </form>
      <dialog ref={dialogo} className="dialogo-admin" aria-labelledby={`confirmar-usuario-${id}`} aria-describedby={`confirmar-usuario-ayuda-${id}`}>
        <h2 id={`confirmar-usuario-${id}`} className="text-2xl">Confirmar cambios</h2>
        <p id={`confirmar-usuario-ayuda-${id}`} className="mt-3 break-words text-sm text-ink-soft">Revise los nuevos permisos de <strong className="text-ink">{nombre}</strong> antes de guardar.</p>
        <dl className="my-5 space-y-3 rounded-xl border border-line p-4 text-sm">
          {valores.rol !== rol && <div><dt className="font-semibold">Rol</dt><dd className="mt-1 text-ink-soft">{etiquetaRol(rol)} → {etiquetaRol(valores.rol)}</dd></div>}
          {valores.activo !== activo && <div><dt className="font-semibold">Estado de la cuenta</dt><dd className="mt-1 text-ink-soft">{activo ? 'Activa' : 'Inactiva'} → {valores.activo ? 'Activa' : 'Inactiva'}</dd></div>}
        </dl>
        {!valores.activo && <p className="aviso aviso-error mb-5">Esta persona perderá el acceso a las funciones de su cuenta.</p>}
        {rol === 'admin' && valores.rol !== 'admin' && <p className="aviso aviso-error mb-5">Esta persona dejará de tener permisos de administración.</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn-secundario" onClick={() => dialogo.current?.close()}>Volver a editar</button>
          <button type="button" className="btn-primario" onClick={() => { confirmado.current = true; dialogo.current?.close(); formProps.ref.current?.requestSubmit() }}>Confirmar cambios</button>
        </div>
      </dialog>
      <ProtectorEdicionAdmin pendiente={hayCambios} nombre={nombre} />
    </>
  )
}

export function FormDenunciaAdmin({ id }: { id: number }) {
  const onResultado = useAvisoAdmin()
  const { estado, pendiente, formProps } = useFormAction(resolverDenunciaAction, {
    onResultado: (resultado) => onResultado(resultado?.mensaje ? { ...resultado, mensaje: `La denuncia #${id} se resolvió correctamente.` } : resultado),
  })

  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="aceptar" disabled={pendiente} className="btn-secundario btn-peligro">
          Aceptar y rechazar reseña
        </button>
        <button name="decision" value="rechazar" disabled={pendiente} className="btn-secundario">
          Descartar denuncia
        </button>
      </div>
      {pendiente && <p role="status" className="text-sm text-ink-soft">Guardando decisión…</p>}
    </form>
  )
}
