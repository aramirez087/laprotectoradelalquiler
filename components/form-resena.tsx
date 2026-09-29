'use client'

import { useState } from 'react'
import { useFormAction } from '@/components/use-form-action'
import type { EstadoForm } from '@/lib/actions/auth'
import { MensajeForm } from '@/components/mensaje-form'
import { nombreCompleto } from '@/lib/util'

export interface PropsFormResena {
  accion: (estado: EstadoForm, datos: FormData) => Promise<EstadoForm>
  enRevision?: boolean
  /** La primera reseña del alta solo se envía una vez. */
  primera?: boolean
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

export function FormResena({ personaInicial, accion, enRevision = true, primera = false }: PropsFormResena) {
  const { estado, pendiente, formProps } = useFormAction(accion)
  const [comentario, setComentario] = useState('')
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
    <form {...formProps} className="space-y-5">
      <p className="text-xs text-ink-soft">Los campos con * son obligatorios. Los demás son opcionales.</p>
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
        ) : <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="etiqueta-campo" htmlFor="identificacion">
              Cédula del inquilino *
            </label>
            <input
              {...atributosError('identificacion')}
              id="identificacion"
              name="identificacion"
              required
              className="campo"
              placeholder="1-0234-0567"
              autoComplete="off"
              spellCheck={false}
              inputMode="numeric"
              maxLength={30}
              aria-describedby={
                errorCampo('identificacion') ? 'error-identificacion ayuda-documento' : 'ayuda-documento'
              }
            />
            <ErrorCampo nombre="identificacion" mensaje={errorCampo('identificacion')} />
            <p id="ayuda-documento" className="mt-2 text-xs text-ink-soft">
              Puede escribirla con o sin guiones. La cédula completa no se muestra al público.
            </p>
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor="nombre">
              Nombre *
            </label>
            <input
              {...atributosError('nombre')}
              minLength={2}
              id="nombre"
              name="nombre"
              required
              className="campo"
              autoComplete="off"
            />
            <ErrorCampo nombre="nombre" mensaje={errorCampo('nombre')} />
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor="nombre2">
              Segundo nombre
            </label>
            <input
              {...atributosError('nombre2')}
              maxLength={100}
              id="nombre2"
              name="nombre2"
              className="campo"
              autoComplete="off"
            />
            <ErrorCampo nombre="nombre2" mensaje={errorCampo('nombre2')} />
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor="apellido1">
              Primer apellido *
            </label>
            <input
              {...atributosError('apellido1')}
              minLength={2}
              id="apellido1"
              name="apellido1"
              required
              className="campo"
              autoComplete="off"
            />
            <ErrorCampo nombre="apellido1" mensaje={errorCampo('apellido1')} />
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor="apellido2">
              Segundo apellido
            </label>
            <input
              {...atributosError('apellido2')}
              maxLength={100}
              id="apellido2"
              name="apellido2"
              className="campo"
              autoComplete="off"
            />
            <ErrorCampo nombre="apellido2" mensaje={errorCampo('apellido2')} />
          </div>
        </div>}
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
        <input id="anonima" name="anonima" type="checkbox" value="1" className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <span className="block text-sm font-medium">Ocultar mi nombre</span>
          <span className="mt-0.5 block text-xs text-ink-soft">
            En la reseña aparece como anónima. No escriba su nombre en el relato. Administración sí ve qué cuenta la
            envió.
          </span>
        </span>
      </label>
      </Paso>
      <div className="cierre-formulario">
        <p className="max-w-sm text-sm text-ink-soft">
          {enRevision
            ? 'Puede seguir la revisión en su perfil. La primera reseña aprobada sobre cada inquilino suma 3 meses de consulta, hasta 12 meses acumulados. Solo puede enviar una reseña por inquilino.'
            : 'Como administración, la reseña se publica de inmediato.'}
        </p>
        <button type="submit" disabled={pendiente} className="btn-primario shrink-0">
          {pendiente ? 'Enviando reseña…' : enRevision ? 'Enviar reseña a revisión' : 'Publicar reseña'}
        </button>
      </div>
    </form>
  )
}
