'use client'

import { useFormAction } from '@/components/use-form-action'
import { useAvisoAdmin } from '@/components/avisos-admin'
import { decidirResenaAction, editarResenaAction, eliminarResenaAction, guardarUsuarioAction, resolverDenunciaAction } from '@/lib/actions/admin'
import { MensajeForm } from '@/components/mensaje-form'
import { etiquetaRol } from '@/lib/util'
import type { Rol, RolAsignable } from '@/lib/tipos'

const DECISIONES = {
  publicar: 'Aprobar y publicar',
  rechazar: 'Rechazar reseña',
  revisar: 'Devolver a revisión',
} as const

export function FormDecision({
  id,
  decisiones,
}: {
  id: number
  decisiones: Array<keyof typeof DECISIONES>
}) {
  const onResultado = useAvisoAdmin()
  const { estado, pendiente, formProps } = useFormAction(decidirResenaAction, {
    onResultado: (resultado) => onResultado(resultado?.mensaje ? { ...resultado, mensaje: `Se guardó la decisión sobre la reseña #${id}.` } : resultado),
  })

  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="etiqueta-campo" htmlFor={`nota-${id}`}>
          Motivo o nota para el autor · opcional
        </label>
        <textarea id={`nota-${id}`} name="nota" rows={2} maxLength={2000} className="campo" placeholder="Explique la decisión para que el autor sepa qué hacer." />
      </div>
      <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
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

function OpcionNotificar({ id, habilitada }: { id: string; habilitada: boolean }) {
  return (
    <div className={habilitada ? '' : 'text-ink-soft'}>
      <label htmlFor={id} className={`flex min-h-11 items-start gap-3 py-2 text-sm ${habilitada ? '' : 'opacity-60'}`}>
        <input id={id} name="notificar" type="checkbox" value="1" disabled={!habilitada}
          aria-describedby={`${id}-ayuda`} className="mt-1 h-4 w-4 shrink-0" />
        <span>Notificar por correo a quien escribió la reseña</span>
      </label>
      <p id={`${id}-ayuda`} className="mt-2 text-xs text-ink-soft">
        {habilitada
          ? 'Se enviará un aviso después de guardar esta acción.'
          : 'El envío de correos aún no está configurado. Puede guardar la acción sin enviar una notificación.'}
      </p>
    </div>
  )
}

export function FormEditarResena({
  id,
  persona,
  comentario,
  anonima,
  notificacionesHabilitadas = false,
}: {
  id: number
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
        <p className="text-sm text-ink-soft">
          Corregir el nombre actualiza al inquilino en todas sus reseñas. Una cédula distinta mueve solo esta reseña.
        </p>
        <fieldset key={JSON.stringify([persona.identificacion, persona.nombre, persona.nombre2, persona.apellido1, persona.apellido2])} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="etiqueta-campo" htmlFor={`identificacion-${id}`}>
              Cédula del inquilino
            </label>
            <input
              id={`identificacion-${id}`}
              name="identificacion"
              required
              maxLength={30}
              defaultValue={persona.identificacion}
              aria-invalid={!!errorCampo('identificacion')}
              aria-describedby={errorCampo('identificacion') ? `error-identificacion-${id}` : undefined}
              className="campo"
              autoComplete="off"
              spellCheck={false}
            />
            <ErrorCampo nombre={`identificacion-${id}`} mensaje={errorCampo('identificacion')} />
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor={`nombre-${id}`}>
              Nombre
            </label>
            <input
              id={`nombre-${id}`}
              name="nombre"
              required
              minLength={2}
              defaultValue={persona.nombre}
              aria-invalid={!!errorCampo('nombre')}
              aria-describedby={errorCampo('nombre') ? `error-nombre-${id}` : undefined}
              className="campo"
              autoComplete="off"
            />
            <ErrorCampo nombre={`nombre-${id}`} mensaje={errorCampo('nombre')} />
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor={`nombre2-${id}`}>
              Segundo nombre
            </label>
            <input id={`nombre2-${id}`} name="nombre2" maxLength={100} defaultValue={persona.nombre2 ?? ''} className="campo" autoComplete="off" />
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor={`apellido1-${id}`}>
              Primer apellido
            </label>
            <input
              id={`apellido1-${id}`}
              name="apellido1"
              required
              minLength={2}
              defaultValue={persona.apellido1}
              aria-invalid={!!errorCampo('apellido1')}
              aria-describedby={errorCampo('apellido1') ? `error-apellido1-${id}` : undefined}
              className="campo"
              autoComplete="off"
            />
            <ErrorCampo nombre={`apellido1-${id}`} mensaje={errorCampo('apellido1')} />
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor={`apellido2-${id}`}>
              Segundo apellido
            </label>
            <input id={`apellido2-${id}`} name="apellido2" maxLength={100} defaultValue={persona.apellido2 ?? ''} className="campo" autoComplete="off" />
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

export function FormUsuario({
  id,
  rol,
  activo,
}: {
  id: number
  rol: Rol
  activo: boolean
}) {
  const { estado, pendiente, formProps } = useFormAction(guardarUsuarioAction)
  const roles: RolAsignable[] = ['propietario', 'agencia', 'admin']

  return (
    <form {...formProps} className="grid items-end gap-3 border-t border-line pt-4 sm:grid-cols-[minmax(0,16rem)_auto_auto] sm:justify-start">
      <input type="hidden" name="id" value={id} />
      <div className="min-w-0">
        <label className="etiqueta-campo" htmlFor={`rol-${id}`}>
          Rol
        </label>
        <select id={`rol-${id}`} name="rol" defaultValue={rol === 'inquilino' ? '' : rol} required className="campo">
          {rol === 'inquilino' && <option value="" disabled>Seleccione un rol vigente</option>}
          {roles.map((opcion) => (
            <option key={opcion} value={opcion}>
              {etiquetaRol(opcion)}
            </option>
          ))}
        </select>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="activo" defaultChecked={activo} />
        Cuenta activa
      </label>
      <button disabled={pendiente} className="btn-secundario">
        {pendiente ? 'Guardando…' : 'Guardar permisos'}
      </button>
      <div className="sm:col-span-3">
        <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      </div>
    </form>
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
