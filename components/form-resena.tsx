'use client'

import { useState } from 'react'
import { useFormAction } from '@/components/use-form-action'
import type { EstadoForm } from '@/lib/actions/auth'
import { MensajeForm } from '@/components/mensaje-form'
import { nombreCompleto } from '@/lib/util'

export interface PropsFormResena {
  accion: (estado: EstadoForm, datos: FormData) => Promise<EstadoForm>
  enRevision?: boolean
  personaInicial: {
    personaId: number
    identificacion: string
    cedulaCompleta: boolean
    nombre: string
    nombre2: string | null
    apellido1: string
    apellido2: string | null
    provinciaId: number | null
  } | null
  lookups: {
    calificaciones: { id: number; valor: number; texto: string }[]
    etiquetas: { id: number; nombre: string }[]
    danos: { id: number; nombre: string }[]
    procesos: { id: number; nombre: string }[]
    contratos: { id: number; nombre: string }[]
    tiposAlquiler: { id: number; nombre: string }[]
    tiempos: { id: number; nombre: string }[]
    provincias: { id: number; nombre: string }[]
  }
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

function Eleccion({
  name,
  leyenda,
  opciones,
}: {
  name: string
  leyenda: string
  opciones: { value: string; texto: string }[]
}) {
  return (
    <fieldset>
      <legend className="etiqueta-campo">{leyenda}</legend>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => (
          <label key={o.value || 'vacio'} className="opcion">
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={o.value === ''}
              className="sr-only"
            />
            <span className="marca-opcion" aria-hidden="true">
              ✓
            </span>
            {o.texto}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function ErrorCampo({ nombre, mensaje }: { nombre: string; mensaje?: string }) {
  return mensaje ? (
    <p id={`error-${nombre}`} className="mt-2 text-sm text-alerta">
      {mensaje}
    </p>
  ) : null
}

export function FormResena({ personaInicial, lookups, accion, enRevision = true }: PropsFormResena) {
  const { estado, pendiente, formProps } = useFormAction(accion)
  const [etiquetasSel, setEtiquetasSel] = useState<number[]>([])
  const [califId, setCalifId] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const calificaciones = [...lookups.calificaciones].sort((a, b) => a.valor - b.valor)
  const calif = calificaciones.find((c) => c.id === califId)
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
      {personaInicial && <input type="hidden" name="personaId" value={personaInicial.personaId} />}
      <div>
        <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      </div>

      <Paso
        numero="1"
        titulo="¿Sobre quién escribe?"
        texto="Revise el nombre y el documento para identificar a la persona correcta."
      >
        {bloqueada && personaInicial && (
          <p className="text-sm text-ink-soft">{nombreCompleto(personaInicial)}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="etiqueta-campo" htmlFor="identificacion">
              Cédula o documento *
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
          <div className="sm:col-span-2">
            {bloqueada ? (
              <p className="text-sm text-ink-soft">
                Provincia:{' '}
                {lookups.provincias.find((p) => p.id === personaInicial?.provinciaId)?.nombre ??
                  'no especificada'}
              </p>
            ) : (
              <>
                <label className="etiqueta-campo" htmlFor="provinciaId">
                  Provincia
                </label>
                <select id="provinciaId" name="provinciaId" defaultValue="" className="campo">
                  <option value="">No especificada</option>
                  {lookups.provincias.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </Paso>

      <Paso
        numero="2"
        titulo="¿Cómo fue el alquiler?"
        texto="Elija una calificación y las etiquetas que describen su experiencia."
      >
        <fieldset>
          <legend className="etiqueta-campo">Calificación *</legend>
          {calificaciones.length === 0 ? (
            <p className="aviso aviso-atencion">
              No pudimos cargar las calificaciones. Recargue la página para intentarlo de nuevo.
            </p>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {calificaciones.map((c) => {
                const activa = califId === c.id
                return (
                  <label
                    key={c.id}
                    className={`calificacion-opcion inline-flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl border text-lg ${activa ? 'border-transparent bg-[var(--boton)] text-[var(--boton-ink)]' : 'border-line'}`}
                    title={c.texto}
                  >
                    <input
                      type="radio"
                      name="calificacionId"
                      value={c.id}
                      checked={activa}
                      onChange={() => setCalifId(c.id)}
                      required
                      {...atributosError('calificacionId')}
                      className="sr-only"
                      aria-label={`${c.valor}: ${c.texto}`}
                    />
                    <span aria-hidden="true">{c.valor}</span>
                  </label>
                )
              })}
            </div>
          )}
          <div className="mt-2 flex justify-between gap-3 text-xs text-ink-soft">
            <span>{calificaciones[0]?.texto}</span>
            <span className="text-right">{calificaciones.at(-1)?.texto}</span>
          </div>
          <p className="mt-3 min-h-6 text-sm text-seal" aria-live="polite">
            {calif
              ? `${calif.valor} de 5 · ${calif.texto}`
              : 'Seleccione la opción que mejor representa su experiencia.'}
          </p>
          <ErrorCampo nombre="calificacionId" mensaje={errorCampo('calificacionId')} />
        </fieldset>

        <fieldset>
          <legend className="etiqueta-campo">Etiquetas · opcional</legend>
          <div className="flex flex-wrap gap-2">
            {lookups.etiquetas.map((e) => {
              const sel = etiquetasSel.includes(e.id)
              return (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={sel}
                  onClick={() =>
                    setEtiquetasSel((prev) =>
                      prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id],
                    )
                  }
                  className={sel ? 'chip chip-on' : 'chip'}
                >
                  {e.nombre}
                </button>
              )
            })}
          </div>
          <input type="hidden" name="etiquetas" value={etiquetasSel.join(',')} />
        </fieldset>

        <Eleccion
          name="recomienda"
          leyenda="¿Le volvería a alquilar?"
          opciones={[
            { value: 'si', texto: 'Sí' },
            { value: 'no', texto: 'No' },
            { value: '', texto: 'Prefiero no indicarlo' },
          ]}
        />
        <details className="detalles-formulario">
          <summary>
            <span>
              <span className="block font-medium">Añadir detalles del alquiler</span>
              <span className="mt-1 block text-xs text-ink-soft">
                Contrato, fechas, daños y otros antecedentes · opcional
              </span>
            </span>
            <span className="indicador-detalle" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="space-y-5 pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="etiqueta-campo" htmlFor="danoId">
                  Daño a la propiedad
                </label>
                <select id="danoId" name="danoId" className="campo" defaultValue="">
                  <option value="">No aplica</option>
                  {lookups.danos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="etiqueta-campo" htmlFor="procesoId">
                  Proceso judicial
                </label>
                <select id="procesoId" name="procesoId" className="campo" defaultValue="">
                  <option value="">No aplica</option>
                  {lookups.procesos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="etiqueta-campo" htmlFor="contratoId">
                  Tipo de contrato
                </label>
                <select id="contratoId" name="contratoId" className="campo" defaultValue="">
                  <option value="">No aplica</option>
                  {lookups.contratos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="etiqueta-campo" htmlFor="tipoAlquilerId">
                  Tipo de alquiler
                </label>
                <select id="tipoAlquilerId" name="tipoAlquilerId" className="campo" defaultValue="">
                  <option value="">No aplica</option>
                  {lookups.tiposAlquiler.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="etiqueta-campo" htmlFor="tiempoId">
                  Duración del alquiler
                </label>
                <select id="tiempoId" name="tiempoId" className="campo" defaultValue="">
                  <option value="">No aplica</option>
                  {lookups.tiempos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="etiqueta-campo" htmlFor="fechaInicio">
                    Inicio
                  </label>
                  <input id="fechaInicio" type="date" name="fechaInicio" className="campo" />
                </div>
                <div>
                  <label className="etiqueta-campo" htmlFor="fechaFin">
                    Fin
                  </label>
                  <input
                    id="fechaFin"
                    type="date"
                    name="fechaFin"
                    {...atributosError('fechaFin')}
                    className="campo"
                  />
                  <ErrorCampo nombre="fechaFin" mensaje={errorCampo('fechaFin')} />
                </div>
              </div>
            </div>

            <div>
              <label className="etiqueta-campo" htmlFor="detalleDano">
                Detalle del daño, si lo hubo
              </label>
              <textarea id="detalleDano" name="detalleDano" rows={3} maxLength={2000} className="campo" />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Eleccion
                name="drogas"
                leyenda="¿Reporta consumo de sustancias?"
                opciones={[
                  { value: 'si', texto: 'Sí' },
                  { value: 'no', texto: 'No' },
                  { value: '', texto: 'Prefiero no indicarlo' },
                ]}
              />
            </div>
          </div>
        </details>
      </Paso>

      <Paso
        numero="3"
        titulo="Cuéntenos un poco más"
        texto="Describa hechos concretos y que pueda respaldar. Evite incluir teléfonos, direcciones u otros datos personales."
      >
        <div>
          <label htmlFor="comentario" className="etiqueta-campo">
            Su experiencia · opcional
          </label>
          <textarea
            id="comentario"
            name="comentario"
            rows={6}
            maxLength={5000}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            aria-describedby="ayuda-comentario"
            className="campo"
            placeholder="Por ejemplo: cómo fue la comunicación, el cumplimiento de los pagos y la entrega de la propiedad."
          />
          <p id="ayuda-comentario" className="mt-2 text-right text-xs text-ink-soft">
            {comentario.length.toLocaleString('es-CR')} / 5.000 caracteres
          </p>
        </div>
      </Paso>
      <div className="cierre-formulario">
        <p className="max-w-sm text-sm text-ink-soft">
          {enRevision
            ? 'Su reseña se enviará a revisión. Puede seguir su estado en su perfil.'
            : 'Revise los datos antes de publicar su reseña.'}
        </p>
        <button disabled={pendiente || calificaciones.length === 0} className="btn-primario shrink-0">
          {pendiente ? 'Enviando reseña…' : enRevision ? 'Enviar reseña a revisión' : 'Publicar reseña'}
        </button>
      </div>
    </form>
  )
}
