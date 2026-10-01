'use client'

import { useState } from 'react'
import { formatoNumero } from '@/lib/util'

type Dia = { fecha: string; vistas: number | null; visitantes: number | null }
const ANCHO = 1000
const ALTO = 220

function fechaCorta(fecha: string) {
  return new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`))
}

function tramos(serie: Dia[], campo: 'vistas' | 'visitantes', maximo: number) {
  const segmentos: { x: number; y: number }[][] = []
  let actual: { x: number; y: number }[] = []
  for (let i = 0; i < serie.length; i++) {
    const valor = serie[i][campo]
    if (valor === null) { if (actual.length) segmentos.push(actual); actual = []; continue }
    actual.push({ x: i / Math.max(1, serie.length - 1) * ANCHO, y: ALTO - valor / maximo * ALTO })
  }
  if (actual.length) segmentos.push(actual)
  return segmentos
}

export function GraficoAudiencia({ serie }: { serie: Dia[] }) {
  const [activo, setActivo] = useState<number | null>(null)
  const disponibles = serie.filter(d => d.vistas !== null)
  const mayor = Math.max(1, ...serie.flatMap(d => [d.vistas ?? 0, d.visitantes ?? 0]))
  const paso = Math.max(1, 10 ** Math.floor(Math.log10(mayor)))
  const maximo = Math.ceil(mayor / paso) * paso
  const marcas = [...new Set([maximo, Math.round(maximo / 2), 0])]
  const seleccionado = activo === null ? disponibles.at(-1) : serie[activo]
  const indice = activo === null ? -1 : activo
  const xActivo = indice / Math.max(1, serie.length - 1) * ANCHO
  const cantidad = (valor: number | null) => valor === null ? 'Pendiente' : formatoNumero(valor)
  const lineas = tramos(serie, 'vistas', maximo)
  const visitantes = tramos(serie, 'visitantes', maximo)

  return <section className="expediente min-w-0 overflow-hidden" aria-labelledby="titulo-trafico">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="titulo-trafico" className="text-lg font-medium">Tráfico por día</h2><div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-seal" />Páginas vistas</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-2 w-2 rounded-full border border-ink-soft" />Visitantes únicos</span>
      </div></div>
      {seleccionado && <div className="rounded-lg border border-line bg-paper px-3 py-2 text-right text-xs leading-5" aria-live="polite" aria-atomic="true">
        <p className="font-medium text-ink">{fechaCorta(seleccionado.fecha)}</p>
        <p className="text-ink-soft"><span className="font-medium tabular-nums text-seal">{cantidad(seleccionado.vistas)}</span> páginas · <span className="font-medium tabular-nums text-ink">{cantidad(seleccionado.visitantes)}</span> visitantes</p>
      </div>}
    </div>
    {disponibles.length === 0 ? <div className="mt-6 flex min-h-48 items-center justify-center rounded-lg border border-dashed border-control-line bg-paper p-6 text-center">
      <div><p className="text-sm font-medium">Aquí verá cómo crece la audiencia</p><p className="mt-2 max-w-sm text-xs leading-5 text-ink-soft">El gráfico aparecerá cuando estén listos los primeros informes. Los días pendientes se mantendrán como espacios sin datos.</p></div>
    </div> : <>
      <p id="ayuda-grafico" className="sr-only">Use las flechas izquierda y derecha para consultar cada día. Inicio y Fin llevan al primero y al último. Las cifras completas también están en la tabla debajo.</p>
      <div className="relative mt-7 pl-10">
        <div aria-hidden="true" className="relative h-56">
          {marcas.map(m => <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ top: `${(1 - m / maximo) * 100}%` }}><span className="absolute -left-10 -top-2 w-8 text-right text-[11px] tabular-nums text-ink-soft">{formatoNumero(m)}</span></div>)}
        </div>
        <div tabIndex={0} role="group" aria-label="Explorar tráfico por día" aria-describedby="ayuda-grafico" className="absolute inset-y-0 left-10 right-0 rounded-sm outline-offset-4"
          onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); setActivo(Math.max(0, Math.min(serie.length - 1, Math.round((event.clientX - rect.left) / rect.width * (serie.length - 1))))) }}
          onPointerLeave={() => setActivo(null)} onFocus={() => setActivo(serie.length - 1)} onBlur={() => setActivo(null)}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            setActivo(previous => event.key === 'Home' ? 0 : event.key === 'End' ? serie.length - 1 : Math.max(0, Math.min(serie.length - 1, (previous ?? serie.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))))
          }}>
          <svg aria-hidden="true" viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
            {lineas.map((segmento, i) => <g key={i}>
              {segmento.length > 1 && <path fill="var(--seal)" fillOpacity="0.09" d={`M${segmento[0].x},${ALTO} ${segmento.map(p => `L${p.x},${p.y}`).join(' ')} L${segmento.at(-1)!.x},${ALTO} Z`} />}
              <polyline fill="none" stroke="var(--seal)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" points={segmento.map(p => `${p.x},${p.y}`).join(' ')} />
              {segmento.length === 1 && <circle cx={segmento[0].x} cy={segmento[0].y} r="4" fill="var(--seal)" />}
            </g>)}
            {visitantes.map((segmento, i) => <g key={i}>
              <polyline fill="none" stroke="var(--ink-soft)" strokeWidth="1.5" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" points={segmento.map(p => `${p.x},${p.y}`).join(' ')} />
              {segmento.length === 1 && <circle cx={segmento[0].x} cy={segmento[0].y} r="4" fill="var(--ink-soft)" />}
            </g>)}
            {activo !== null && <>
              <line x1={xActivo} x2={xActivo} y1="0" y2={ALTO} stroke="var(--control-line)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
              {(['vistas', 'visitantes'] as const).map(campo => serie[activo][campo] !== null && <circle key={campo} cx={xActivo} cy={ALTO - serie[activo][campo]! / maximo * ALTO} r="4" fill={campo === 'vistas' ? 'var(--seal)' : 'var(--ink-soft)'} stroke="var(--card)" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
            </>}
          </svg>
        </div>
      </div>
      <div aria-hidden="true" className="mt-3 flex justify-between gap-3 pl-10 text-[11px] text-ink-soft"><span>{fechaCorta(serie[0].fecha)}</span><span>{fechaCorta(serie[Math.floor((serie.length - 1) / 2)].fecha)}</span><span>{fechaCorta(serie.at(-1)!.fecha)}</span></div>
      <p className="mt-3 text-xs text-ink-soft">Explore el gráfico con el cursor o con las flechas del teclado. Los espacios sin línea corresponden a días pendientes.</p>
    </>}
    <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-medium text-seal">Ver cifras por día</summary>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Visitantes y páginas vistas por día</caption><thead className="text-ink-soft"><tr><th scope="col" className="py-2 font-medium">Día</th><th scope="col" className="py-2 text-right font-medium">Visitantes únicos</th><th scope="col" className="py-2 text-right font-medium">Páginas vistas</th></tr></thead><tbody>{serie.map(d => <tr key={d.fecha} className="border-t border-line"><th scope="row" className="py-2 font-normal">{fechaCorta(d.fecha)}</th><td className="py-2 text-right tabular-nums">{cantidad(d.visitantes)}</td><td className="py-2 text-right tabular-nums">{cantidad(d.vistas)}</td></tr>)}</tbody></table></div>
    </details>
  </section>
}
