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
        texto="Escriba el nombre y la cédula para identificar al inquilino."
      >
        {bloqueada && personaInicial && <p className="text-sm text-ink-soft">{nombreCompleto(personaInicial)}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="etiqueta-campo" htmlFor="identificacion">
              Cédula del inquilino *
            </label>
            <input
              {...atributosError('identificacion')}
              id="identificacion"
              name={bloqueada ? undefined : 'identificacion'}
              required={!bloqueada}
              readOnly={bloqueada}
              defaultValue={personaInicial?.identificacion ?? ''}
              className="campo"
              placeholder="1-0234-0567"
              autoComplete="off"
              spellCheck={false}
              maxLength={30}
              aria-describedby={
                errorCampo('identificacion') ? 'error-identificacion ayuda-documento' : 'ayuda-documento'
              }
            />
            <ErrorCampo nombre="identificacion" mensaje={errorCampo('identificacion')} />
            <p id="ayuda-documento" className="mt-2 text-xs text-ink-soft">
              La cédula completa no se muestra al público.
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
              readOnly={bloqueada}
              defaultValue={personaInicial?.nombre ?? ''}
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
              maxLength={100}
              id="nombre2"
              name="nombre2"
              readOnly={bloqueada}
              defaultValue={personaInicial?.nombre2 ?? ''}
              className="campo"
              autoComplete="off"
            />
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
              readOnly={bloqueada}
              defaultValue={personaInicial?.apellido1 ?? ''}
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
              maxLength={100}
              id="apellido2"
              name="apellido2"
              readOnly={bloqueada}
              defaultValue={personaInicial?.apellido2 ?? ''}
              className="campo"
              autoComplete="off"
            />
          </div>
        </div>
      </Paso>

      <Paso
        numero="2"
        titulo="Cuéntenos un poco más"
        texto="Describa hechos concretos y que pueda respaldar. Evite incluir teléfonos, direcciones u otros datos personales."
      >
        <div>
          <label htmlFor="fechaInicio" className="etiqueta-campo">Inicio del alquiler *</label>
          <input
            {...atributosError('fechaInicio')}
            id="fechaInicio"
            name="fechaInicio"
            type="date"
            required
            className="campo"
            aria-describedby={errorCampo('fechaInicio') ? 'error-fechaInicio ayuda-inicio' : 'ayuda-inicio'}
          />
          <ErrorCampo nombre="fechaInicio" mensaje={errorCampo('fechaInicio')} />
          <p id="ayuda-inicio" className="mt-2 text-xs text-ink-soft">
            Use la fecha en que comenzó este alquiler. Varias reseñas sobre el mismo alquiler cuentan como una sola experiencia para su permiso.
          </p>
        </div>
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
          <p id="ayuda-comentario" className="mt-2 text-right text-xs text-ink-soft">
            {comentario.length.toLocaleString('es-CR')} / 5.000 caracteres
          </p>
        </div>
      </Paso>
      <label htmlFor="anonima" className="opcion-rol flex items-start gap-3">
        <input id="anonima" name="anonima" type="checkbox" value="1" className="mt-1 h-4 w-4 shrink-0" />
        <span>
          <span className="block text-sm font-medium">Ocultar mi nombre</span>
          <span className="mt-0.5 block text-xs text-ink-soft">
            En la reseña aparece como anónima. No escriba su nombre en el relato. Administración sí ve qué cuenta la
            envió.
          </span>
        </span>
      </label>
      <div className="cierre-formulario">
        <p className="max-w-sm text-sm text-ink-soft">
          {enRevision
            ? 'Esta reseña se envía a revisión. No queda publicada hasta que administración la apruebe. Puede seguir el estado en su perfil.'
            : 'Como administración, la reseña se publica de inmediato.'}
        </p>
        <button disabled={pendiente} className="btn-primario shrink-0">
          {pendiente ? 'Enviando…' : enRevision ? 'Enviar reseña a revisión' : 'Publicar ahora'}
        </button>
      </div>
    </form>
  )
}
