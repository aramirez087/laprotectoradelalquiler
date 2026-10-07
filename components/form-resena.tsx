'use client'

import { useRef, useState } from 'react'
import { useFormAction } from '@/components/use-form-action'
import type { EstadoForm } from '@/lib/actions/auth'
import { MensajeForm } from '@/components/mensaje-form'
import { CamposIdentidad } from '@/components/campos-identidad'
import { nombreCompleto } from '@/lib/util'
import { useBorradorResena } from '@/components/use-borrador-resena'
import type { EstadoBorrador } from '@/lib/borrador-resena'
import { ProtectorEdicionAdmin } from '@/components/protector-edicion-admin'

export interface PropsFormResena {
  accion: (estado: EstadoForm, datos: FormData) => Promise<EstadoForm>
  enRevision?: boolean
  /** La primera reseña del alta solo se envía una vez. */
  primera?: boolean
  borrador?: EstadoBorrador
  personaInicial: {
    personaId: number
    identificacion: string
    nombre: string
    nombre2: string | null
    apellido1: string
    apellido2: string | null
  } | null
}

function Paso({
  numero,
  titulo,
  texto,
  children,
}: {
  numero: string
  titulo: string
  texto: string
  children: React.ReactNode
}) {
  return (
    <section className="seccion-formulario space-y-5">
      <div className="flex items-start gap-3">
        <span className="numero-paso" aria-hidden="true">
          {numero}
        </span>
        <div>
          <h2 className="text-xl">{titulo}</h2>
          <p className="mt-1 text-sm text-ink-soft">{texto}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function ErrorCampo({ nombre, mensaje }: { nombre: string; mensaje?: string }) {
  return mensaje ? (
    <p id={`error-${nombre}`} className="mt-2 text-sm text-alerta">
      {mensaje}
    </p>
  ) : null
}

export function FormResena({ personaInicial, accion, enRevision = true, primera = false, borrador }: PropsFormResena) {
  const formulario = useRef<HTMLFormElement>(null)
  const draft = useBorradorResena(borrador, personaInicial?.personaId ?? null, formulario)
  const { estado, pendiente, formProps } = useFormAction(accion, { formulario, onResultado: () => draft.continuar() })
  const [comentario, setComentario] = useState(borrador?.datos?.comentario ?? '')
  const [avisoValidacion, setAvisoValidacion] = useState('')
  const bloqueada = personaInicial != null

  function errorCampo(nombre: string) {
    return estado?.campos?.[nombre]
  }
  function atributosError(nombre: string) {
    return {
      'aria-invalid': !!errorCampo(nombre),
      'aria-describedby': errorCampo(nombre) ? `error-${nombre}` : undefined,
    }
  }

  return (
    <form {...formProps}
      onChange={() => { setAvisoValidacion(''); draft.cambio() }}
      onInvalid={event => {
        const campos = Array.from(event.currentTarget.elements)
          .filter((campo): campo is HTMLInputElement | HTMLTextAreaElement =>
            (campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement) && campo.willValidate && !campo.validity.valid)
          .map(campo => campo.labels?.[0]?.textContent?.replace(/\s*\*\s*$/, '').trim())
          .filter(Boolean)
        setAvisoValidacion(`Revise estos campos antes de enviar la reseña: ${campos.join(', ')}.`)
      }}
      onSubmit={event => { setAvisoValidacion(''); draft.pausar(); formProps.onSubmit(event) }} className="space-y-5">
      <ProtectorEdicionAdmin pendiente={!pendiente && ['cambios','guardando','error','conflicto'].includes(draft.estado)} nombre="la reseña" />
      <p className="text-xs text-ink-soft">Los campos con * son obligatorios. Los demás son opcionales.</p>
      {borrador && <div className="rounded-xl border border-line p-4 text-sm">
        <p role="status">{!draft.disponible ? 'El guardado de borradores no está disponible. Guarde su texto antes de salir.'
          : draft.estado === 'guardando' ? 'Guardando borrador…'
            : draft.estado === 'guardado' ? 'Borrador guardado en su cuenta.'
              : draft.estado === 'cambios' ? 'Hay cambios por guardar.'
                : draft.estado === 'error' || draft.estado === 'conflicto' ? draft.error
                  : 'Su borrador se guarda automáticamente en su cuenta mientras escribe.'}</p>
        <p className="mt-2 text-xs text-ink-soft">Solo usted puede retomarlo. Se conserva durante 30 días desde el último guardado. Guardar no envía la reseña.</p>
        {draft.disponible && draft.estado !== 'conflicto' && <button type="button" className="enlace-texto mt-3 min-h-11" disabled={pendiente || draft.estado === 'guardando'} onClick={() => void draft.guardar()}>Guardar borrador ahora</button>}
      </div>}
      {primera && <input type="hidden" name="modo" value="registro" />}
      {personaInicial && <input type="hidden" name="personaId" value={personaInicial.personaId} />}
      <div>
        <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      </div>

      <Paso
        numero="1"
        titulo="Identificación del inquilino"
        texto={bloqueada ? 'Esta reseña se agregará a la ficha que seleccionó.' : 'Revise el nombre y la cédula para que la reseña llegue a la persona correcta.'}
      >
        {bloqueada && personaInicial ? (
          <div className="rounded-xl border border-line bg-paper p-4">
            <p className="break-words text-lg font-medium">{nombreCompleto(personaInicial)}</p>
            <p className="mt-1 break-words text-sm text-ink-soft">Documento {personaInicial.identificacion}</p>
            <p className="mt-3 text-xs text-ink-soft">Los datos de esta ficha ya están registrados.</p>
            <input type="hidden" name="nombre" value={personaInicial.nombre} />
            <input type="hidden" name="nombre2" value={personaInicial.nombre2 ?? ''} />
            <input type="hidden" name="apellido1" value={personaInicial.apellido1} />
            <input type="hidden" name="apellido2" value={personaInicial.apellido2 ?? ''} />
          </div>
        ) : <CamposIdentidad inicial={borrador?.datos ?? undefined} errores={estado?.campos} onCambio={draft.cambio} />}
      </Paso>

      <Paso
        numero="2"
        titulo="Comparta lo que ocurrió"
        texto="Describa hechos concretos y que pueda respaldar. Evite incluir teléfonos, direcciones u otros datos personales."
      >
        <div>
          <label htmlFor="comentario" className="etiqueta-campo">
            Su experiencia *
          </label>
          <textarea
            {...atributosError('comentario')}
            id="comentario"
            name="comentario"
            rows={6}
            required
            minLength={30}
            maxLength={5000}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            aria-describedby={errorCampo('comentario') ? 'error-comentario ayuda-comentario' : 'ayuda-comentario'}
            className="campo"
            placeholder="Por ejemplo: cómo fue la comunicación, el cumplimiento de los pagos y la entrega de la propiedad."
          />
          <ErrorCampo nombre="comentario" mensaje={errorCampo('comentario')} />
          <div id="ayuda-comentario" className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-ink-soft">
            <span>Mínimo 30 caracteres. Unas pocas frases bastan.</span>
            <span className="tabular-nums">{comentario.length.toLocaleString('es-CR')} / 5.000</span>
          </div>
        </div>
      <label htmlFor="anonima" className="opcion-rol flex items-start gap-3">
        <input id="anonima" name="anonima" type="checkbox" value="1" defaultChecked={borrador?.datos?.anonima ?? false} className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <span className="block text-sm font-medium">Ocultar mi nombre</span>
          <span className="mt-0.5 block text-xs text-ink-soft">
            En la reseña aparece como anónima. No escriba su nombre en el relato. Administración sí ve qué cuenta la
            envió.
          </span>
        </span>
      </label>
      </Paso>
      <MensajeForm error={avisoValidacion} />
      <div className="cierre-formulario">
        <p className="max-w-sm text-sm text-ink-soft">
          {enRevision
            ? 'Puede seguir el estado en su perfil. La primera reseña aprobada sobre cada inquilino suma 3 meses de consulta, hasta 12 meses acumulados. Solo puede enviar una reseña por inquilino.'
            : 'Como administración, la reseña se publica de inmediato.'}
        </p>
        <button type="submit" disabled={pendiente} className="btn-primario shrink-0">
          {pendiente ? 'Enviando reseña…' : enRevision ? 'Enviar reseña' : 'Publicar reseña'}
        </button>
      </div>
    </form>
  )
}
