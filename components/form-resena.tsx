'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { crearResenaAction } from '@/lib/actions/resenas'
import { MensajeForm } from '@/components/mensaje-form'
import { nombreCompleto } from '@/lib/util'

export interface PropsFormResena {
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

function Paso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg">{titulo}</h2>
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
            <input type="radio" name={name} value={o.value} defaultChecked={o.value === ''} className="sr-only" />
            {o.texto}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function FormResena({ personaInicial, lookups }: PropsFormResena) {
  const [estado, action, pendiente] = useActionState(crearResenaAction, undefined)
  const [etiquetasSel, setEtiquetasSel] = useState<number[]>([])
  const [califId, setCalifId] = useState<number | null>(null)
  const aviso = useRef<HTMLDivElement>(null)
  const calificaciones = [...lookups.calificaciones].sort((a, b) => a.valor - b.valor)
  const calif = calificaciones.find((c) => c.id === califId)
  const bloqueada = personaInicial != null

  useEffect(() => {
    if (!estado?.error && !estado?.mensaje) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    aviso.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    aviso.current?.focus()
  }, [estado])

  return (
    <form action={action} className="space-y-5">
      {personaInicial && <input type="hidden" name="personaId" value={personaInicial.personaId} />}
      <div ref={aviso} tabIndex={-1}>
        <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      </div>

      <Paso titulo="Persona">
        {bloqueada && personaInicial && (
          <p className="text-sm text-ink-soft">{nombreCompleto(personaInicial)}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="etiqueta-campo" htmlFor="identificacion">
              Cédula o documento
            </label>
            <input
              id="identificacion"
              name={bloqueada ? undefined : 'identificacion'}
              required={!bloqueada}
              readOnly={bloqueada}
              defaultValue={personaInicial?.identificacion ?? ''}
              className="campo"
              placeholder="1-0234-0567"
              autoComplete="off"
              spellCheck={false}
              inputMode={bloqueada ? undefined : 'text'}
            />

          </div>
          <div>
            <label className="etiqueta-campo" htmlFor="nombre">
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              required
              readOnly={bloqueada}
              defaultValue={personaInicial?.nombre ?? ''}
              className="campo"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor="nombre2">
              Segundo nombre
            </label>
            <input
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
              Primer apellido
            </label>
            <input
              id="apellido1"
              name="apellido1"
              required
              readOnly={bloqueada}
              defaultValue={personaInicial?.apellido1 ?? ''}
              className="campo"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="etiqueta-campo" htmlFor="apellido2">
              Segundo apellido
            </label>
            <input
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
                {lookups.provincias.find((p) => p.id === personaInicial?.provinciaId)?.nombre ?? 'no especificada'}
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

      <Paso titulo="Experiencia">
        <fieldset>
          <legend className="etiqueta-campo">Calificación</legend>
          {calificaciones.length === 0 ? (
            <p className="aviso aviso-atencion">
              Faltan las calificaciones del registro. Ejecute <code>npm run db:aplicar</code>.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Calificación">
              {calificaciones.map((c) => {
                const activa = califId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={activa}
                    onClick={() => setCalifId(c.id)}
                    className={`estrellas h-11 w-11 rounded-full border text-lg ${activa ? 'border-transparent bg-[var(--boton)] text-[var(--boton-ink)]' : 'border-line'}`}
                    aria-label={`${c.valor}: ${c.texto}`}
                    title={c.texto}
                  >
                    {c.valor}
                  </button>
                )
              })}
            </div>
          )}
          <input type="hidden" name="calificacionId" value={califId ?? ''} />
          {calif && <p className="mt-2 text-sm text-ink-soft">{calif.texto}</p>}
        </fieldset>

        <div>
          <span className="etiqueta-campo">Etiquetas, las que apliquen</span>
          <div className="flex flex-wrap gap-2">
            {lookups.etiquetas.map((e) => {
              const sel = etiquetasSel.includes(e.id)
              return (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={sel}
                  onClick={() =>
                    setEtiquetasSel((prev) => (prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id]))
                  }
                  className={sel ? 'chip chip-on' : 'chip'}
                >
                  {e.nombre}
                </button>
              )
            })}
          </div>
          <input type="hidden" name="etiquetas" value={etiquetasSel.join(',')} />
        </div>

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
              <input id="fechaFin" type="date" name="fechaFin" className="campo" />
            </div>
          </div>
        </div>

        <div>
          <label className="etiqueta-campo" htmlFor="detalleDano">
            Detalle del daño, si lo hubo
          </label>
          <textarea
            id="detalleDano"
            name="detalleDano"
            rows={3}
            maxLength={2000}
            className="campo"

          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Eleccion
            name="recomienda"
            leyenda="¿Lo volvería a alquilar?"
            opciones={[
              { value: 'si', texto: 'Sí' },
              { value: 'no', texto: 'No' },
              { value: '', texto: 'Prefiero no indicarlo' },
            ]}
          />
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
      </Paso>

      <Paso titulo="Comentario">
        <textarea id="comentario" name="comentario" rows={6} maxLength={5000} aria-label="Comentario" className="campo" />
        <button disabled={pendiente || calificaciones.length === 0} className="btn-primario">
          {pendiente ? 'Guardando…' : 'Publicar reseña'}
        </button>
      </Paso>
    </form>
  )
}
