import Link from 'next/link'
import { FormDecision } from '@/components/admin-formularios'
import { CalificacionEstrellas } from '@/components/calificacion-estrellas'
import type { FilaAdminResena } from '@/lib/admin'
import { etiquetaEstado, fechaCorta, nombreCompleto } from '@/lib/util'
import type { EstadoResena } from '@/lib/tipos'

function decisionesDe(estado: EstadoResena): Array<'publicar' | 'rechazar' | 'revisar'> {
  if (estado === 'borrador') return ['publicar', 'rechazar']
  if (estado === 'oculta') return ['publicar', 'revisar']
  return ['rechazar']
}

export function ResenaAdmin({ fila }: { fila: FilaAdminResena }) {
  const nombre = nombreCompleto(fila.persona)

  return (
    <article className="expediente space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/fichas/${fila.persona.id}`} className="text-xl">
            {nombre}
          </Link>
          <p className="text-sm text-ink-soft">
            {[fila.persona.identificacion, fila.autor?.nombre ?? 'Sin autor', fechaCorta(fila.creado_en)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {fila.autor && (fila.autor.identificacion || fila.autor.facebook) && (
            <p className="text-sm text-ink-soft">
              {fila.autor.identificacion ? `Cédula del autor ${fila.autor.identificacion}` : 'Autor'}
              {fila.autor.facebook && (
                <>
                  {' · '}
                  <a
                    href={fila.autor.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-seal underline-offset-2 hover:underline"
                  >
                    Facebook
                    <span className="sr-only"> (se abre en una pestaña nueva)</span>
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={fila.estado === 'publicada' ? 'chip chip-ok' : 'chip chip-alerta'}>{etiquetaEstado(fila.estado)}</span>
          <CalificacionEstrellas valor={fila.calificacion?.valor ?? null} texto={fila.calificacion?.texto} />
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm">{fila.comentario?.trim() || 'Sin comentario.'}</p>
      {fila.detalle_verificacion && <p className="text-sm text-ink-soft">{fila.detalle_verificacion}</p>}
      <FormDecision id={fila.id} decisiones={decisionesDe(fila.estado)} />
    </article>
  )
}
