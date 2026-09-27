'use client'

import { useFormAction } from '@/components/use-form-action'
import { decidirResenaAction, guardarUsuarioAction, resolverDenunciaAction } from '@/lib/actions/admin'
import { MensajeForm } from '@/components/mensaje-form'
import { etiquetaRol } from '@/lib/util'
import type { Rol } from '@/lib/tipos'

const DECISIONES = {
  publicar: 'Aprobar',
  rechazar: 'Rechazar',
  revisar: 'A revisión',
} as const

export function FormDecision({
  id,
  decisiones,
}: {
  id: number
  decisiones: Array<keyof typeof DECISIONES>
}) {
  const { estado, pendiente, formProps } = useFormAction(decidirResenaAction)

  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="etiqueta-campo" htmlFor={`nota-${id}`}>
          Motivo o nota para el autor · opcional
        </label>
        <input id={`nota-${id}`} name="nota" maxLength={2000} className="campo" placeholder="Explique la decisión para que el autor sepa qué hacer." />
      </div>
      <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      <div className="flex flex-wrap gap-2">
        {decisiones.map((decision) => (
          <button key={decision} name="decision" value={decision} disabled={pendiente} className={decision === 'publicar' ? 'btn-primario' : decision === 'rechazar' ? 'btn-secundario btn-peligro' : 'btn-secundario'}>
            {pendiente ? 'Guardando…' : DECISIONES[decision]}
          </button>
        ))}
      </div>
    </form>
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
  const roles: Rol[] = ['propietario', 'agencia', 'inquilino', 'admin']

  return (
    <form {...formProps} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="etiqueta-campo" htmlFor={`rol-${id}`}>
          Rol
        </label>
        <select id={`rol-${id}`} name="rol" defaultValue={rol} className="campo">
          {roles.map((opcion) => (
            <option key={opcion} value={opcion}>
              {etiquetaRol(opcion)}
            </option>
          ))}
        </select>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="activo" defaultChecked={activo} />
        Activa
      </label>
      <button disabled={pendiente} className="btn-secundario">
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>
      <div className="basis-full">
        <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      </div>
    </form>
  )
}

export function FormDenunciaAdmin({ id }: { id: number }) {
  const { estado, pendiente, formProps } = useFormAction(resolverDenunciaAction)

  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="aceptar" disabled={pendiente} className="btn-secundario">
          Aceptar y rechazar reseña
        </button>
        <button name="decision" value="rechazar" disabled={pendiente} className="btn-secundario">
          Rechazar denuncia
        </button>
      </div>
    </form>
  )
}
