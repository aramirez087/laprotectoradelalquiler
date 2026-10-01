'use client'

import { useState } from 'react'
import { Icono } from '@/components/icono'

type Escenario = 'con-resenas' | 'sin-resultados'

const escenarios = [
  { valor: 'con-resenas', etiqueta: 'Con reseñas', evento: 'ejemplo_con_resenas' },
  { valor: 'sin-resultados', etiqueta: 'Sin resultados', evento: 'ejemplo_sin_resultados' },
] as const

const relatos = [
  {
    autor: 'Propietario de ejemplo',
    fecha: '2026-09-12',
    fechaVisible: '12 de septiembre de 2026',
    anonimo: false,
    texto: 'Durante el alquiler, los pagos llegaron en la fecha acordada. Cuando se dañó una llave de paso, coordinamos el ingreso para repararla. Al entregar la vivienda, revisamos juntos los pendientes y acordamos cómo resolverlos.',
  },
  {
    autor: 'Autor anónimo',
    fecha: '2026-04-06',
    fechaVisible: '6 de abril de 2026',
    anonimo: true,
    texto: 'Tuvimos un atraso en un pago. Conversamos y se completó unos días después. Al finalizar, hubo diferencias sobre la limpieza; las resolvimos al revisar las fotografías de la entrega. Esta fue mi experiencia en ese alquiler.',
  },
]

export function ConsultaEjemplo() {
  const [escenario, setEscenario] = useState<Escenario>('con-resenas')
  const [anuncio, setAnuncio] = useState('')

  function cambiarEscenario(siguiente: Escenario) {
    if (siguiente === escenario) return
    setEscenario(siguiente)
    setAnuncio(siguiente === 'con-resenas'
      ? 'Ejemplo con reseñas: se muestran una ficha ficticia y dos relatos de ejemplo.'
      : 'Ejemplo sin resultados: no hay fichas para la búsqueda ficticia. Esto no indica un historial positivo ni negativo.')
  }

  return (
    <section aria-labelledby="titulo-consulta-ejemplo" className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="titulo-consulta-ejemplo" className="text-xl">Pruebe dos situaciones</h2>
        <span className="rounded-md border border-seal/25 bg-seal-soft px-2.5 py-1 text-xs font-semibold text-seal">
          Ejemplo ficticio
        </span>
      </div>

      <p className="text-sm leading-relaxed text-ink-soft">
        Esta persona, los autores, las fechas y los relatos son inventados para mostrar cómo funciona la consulta.
      </p>

      <fieldset className="space-y-2">
        <legend className="sr-only">Elija una situación</legend>
        <div className="grid grid-cols-2 gap-2 sm:inline-flex">
          {escenarios.map(({ valor, etiqueta, evento }) => (
            <button
              key={valor}
              type="button"
              aria-pressed={escenario === valor}
              aria-controls="contenido-consulta-ejemplo"
              data-evento-publico={evento}
              onClick={() => cambiarEscenario(valor)}
              className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium sm:px-4 ${
                escenario === valor
                  ? 'border-seal bg-seal-soft text-seal'
                  : 'border-[var(--control-line)] bg-card text-ink hover:border-seal'
              }`}
            >
              <span aria-hidden="true" className="inline-block w-3 text-center">{escenario === valor ? '✓' : ''}</span>
              {etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{anuncio}</p>

      <div id="contenido-consulta-ejemplo" className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line bg-seal-soft px-5 py-3 sm:px-6">
          <span className="text-xs font-semibold text-seal">Ejemplo ficticio</span>
          <span className="text-xs text-ink-soft">{escenario === 'con-resenas' ? 'Vista de una ficha' : 'Vista de una búsqueda'}</span>
        </div>

        {escenario === 'con-resenas' ? (
          <div>
            <header className="space-y-5 p-5 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-seal-soft text-seal">
                  <Icono nombre="documento" />
                </span>
                <div className="min-w-0 space-y-2">
                  <p className="eyebrow">Ficha de ejemplo</p>
                  <h3 className="break-words text-2xl font-medium leading-tight tracking-tight sm:text-3xl">Persona de ejemplo</h3>
                  <p className="text-sm text-ink-soft">
                    Documento <span aria-label="enmascarado" className="tracking-wider">•••••••••</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-line pt-4">
                <p className="text-sm font-semibold text-seal">2 reseñas de ejemplo</p>
                <p className="text-xs text-ink-soft">Última: <time dateTime="2026-09-12">12 de septiembre de 2026</time></p>
              </div>
            </header>

            <div className="border-t border-line px-5 sm:px-6">
              {relatos.map(({ autor, fecha, fechaVisible, anonimo, texto }) => (
                <article key={fecha} className="space-y-4 py-6 [&+article]:border-t [&+article]:border-line">
                  <header className="space-y-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h4 className="text-sm font-semibold">{autor}</h4>
                      {anonimo && <span className="rounded-md border border-line px-2 py-0.5 text-xs text-ink-soft">Nombre no visible</span>}
                    </div>
                    <p className="text-xs leading-relaxed text-ink-soft">
                      <time dateTime={fecha}>{fechaVisible}</time> · Relato ficticio
                    </p>
                  </header>
                  <p className="text-sm leading-7">{texto}</p>
                </article>
              ))}
            </div>

            <p className="border-t border-line bg-paper px-5 py-4 text-xs leading-relaxed text-ink-soft sm:px-6">
              En una consulta real, aquí leerá los relatos publicados. Considérelos junto con su propia evaluación.
            </p>
          </div>
        ) : (
          <div className="space-y-6 p-5 sm:p-6">
            <div className="space-y-2 border-b border-line pb-5">
              <p className="eyebrow">Búsqueda de ejemplo</p>
              <p className="text-base font-medium">Persona de ejemplo</p>
              <p className="text-xs text-ink-soft">No se está buscando a una persona real.</p>
            </div>

            <div className="space-y-4 py-3">
              <Icono nombre="buscar" className="size-7 text-seal" />
              <h3 className="text-2xl">No se encontraron fichas</h3>
              <p className="text-sm leading-relaxed text-ink-soft">
                En esta situación de ejemplo, la búsqueda no devuelve resultados. En una consulta real,
                revise los datos utilizados y pruebe otra vez.
              </p>
              <p className="rounded-xl border border-line bg-paper p-4 text-sm leading-relaxed">
                <strong className="font-semibold">Sin resultados no significa un historial positivo ni negativo.</strong>{' '}
                Puede que la comunidad aún no tenga experiencias publicadas sobre esa persona.
                Complete su evaluación con otras referencias.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
