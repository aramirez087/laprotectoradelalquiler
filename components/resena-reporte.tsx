import Link from '@/components/enlace'
import { ResenaAdmin } from '@/components/resena-admin'
import type { FilaAdminResena } from '@/lib/admin'
import { etiquetaEstado, nombreCompleto } from '@/lib/util'

const fechaHoraReporte = new Intl.DateTimeFormat('es-CR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Costa_Rica',
})

export function ResenaReporte({ fila }: { fila: FilaAdminResena }) {
  const nombre = nombreCompleto(fila.persona)
  const fecha = new Date(fila.creado_en)
  const fechaValida = !Number.isNaN(fecha.getTime())
  const estado = fila.permite_correccion ? 'Corrección solicitada' : etiquetaEstado(fila.estado)
  const comentario = fila.comentario?.replace(/\s+/g, ' ').trim() || 'Sin comentario.'

  return (
    <article className="expediente p-0" aria-labelledby={`reporte-resena-${fila.id}`}>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5 text-ink-soft">
            <span className="font-semibold">Reseña #{fila.id}</span>
            {fechaValida ? <time dateTime={fila.creado_en} title="Hora de Costa Rica">{fechaHoraReporte.format(fecha)}</time> : <span>Fecha no disponible</span>}
          </p>
          <span className={fila.estado === 'publicada' ? 'chip chip-ok' : fila.estado === 'oculta' ? 'chip chip-alerta' : 'chip'}>{estado}</span>
        </div>
        <div>
          <h3 id={`reporte-resena-${fila.id}`} className="text-lg font-medium leading-snug tracking-tight sm:text-xl">
            <Link href={`/fichas/${fila.persona.id}`} className="break-words text-seal underline-offset-4 hover:underline">{nombre}</Link>
          </h3>
          <p className="mt-1 break-words text-xs leading-6 text-ink-soft">Escrita por <span className="font-medium text-ink">{fila.autor?.nombre ?? 'Sin autor registrado'}</span></p>
        </div>
        <p className="line-clamp-3 break-words text-sm leading-6 text-ink-soft">{comentario}</p>
      </div>
      <details className="detalles-admin border-t border-line [&>summary]:px-5 [&>summary]:py-3 sm:[&>summary]:px-6">
        <summary>
          <span>Ver reseña y opciones <span className="sr-only">de {nombre}, reseña {fila.id}</span></span>
          <span className="indicador-admin" aria-hidden="true">⌄</span>
        </summary>
        <div className="detalle-resena-reporte border-t border-line">
          <ResenaAdmin fila={fila} nivelTitulo={3} />
        </div>
      </details>
    </article>
  )
}
