import { CalificacionEstrellas } from '@/components/calificacion-estrellas'
import { Avatar } from '@/components/avatar'
import { FormDenuncia } from '@/components/form-denuncia'
import { esMencionNeutra, etiquetaEstado, etiquetaRol, fechaCorta, urlImagen } from '@/lib/util'
import type { FilaResenaCompleta } from '@/lib/tipos'

export function TarjetaResena({
  resena,
  puedeDenunciar,
}: {
  resena: FilaResenaCompleta
  puedeDenunciar: boolean
}) {
  const autor = resena.autor?.nombre ?? 'Reseña importada'
  const fotos = [...(resena.fotos ?? [])].sort((a, b) => a.orden - b.orden)

  return (
    <article className="expediente space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar nombre={autor} tamano="sm" />
          <div>
            <p className="text-sm font-semibold">{autor}</p>
            <p className="text-xs text-ink-soft">
              {etiquetaRol(resena.autor?.rol ?? 'propietario')}
              {resena.creado_en ? ` · ${fechaCorta(resena.creado_en)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {resena.estado !== 'publicada' && (
            <span className="chip chip-alerta">{etiquetaEstado(resena.estado)}</span>
          )}
          {resena.verificada && <span className="chip chip-ok">Verificada</span>}
          <CalificacionEstrellas valor={resena.calificacion?.valor ?? null} texto={resena.calificacion?.texto} />
        </div>
      </div>

      {(resena.etiquetas.length > 0 || resena.dano || resena.proceso || resena.drogas || (resena.conductas?.length ?? 0) > 0) && (
        <div className="flex flex-wrap gap-2">
          {resena.etiquetas.map((e, i) => (
            <span key={`${e.etiqueta.nombre}-${i}`} className="chip">
              {e.etiqueta.nombre}
            </span>
          ))}
          {(resena.conductas ?? []).map((c, i) =>
            c.conducta?.nombre ? (
              <span key={`${c.conducta.nombre}-${i}`} className="chip">
                {c.conducta.nombre}
              </span>
            ) : null,
          )}
          {resena.dano && (
            <span className={esMencionNeutra(resena.dano.nombre, 'dano') ? 'chip' : 'chip chip-alerta'}>
              Daño: {resena.dano.nombre}
            </span>
          )}
          {resena.proceso && (
            <span className={esMencionNeutra(resena.proceso.nombre, 'proceso') ? 'chip' : 'chip chip-alerta'}>
              Proceso: {resena.proceso.nombre}
            </span>
          )}
          {resena.drogas && <span className="chip chip-alerta">Reporte de sustancias</span>}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {resena.contrato && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Contrato</dt>
            <dd>{resena.contrato.nombre}</dd>
          </div>
        )}
        {resena.tipoAlquiler && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Alquiler</dt>
            <dd>{resena.tipoAlquiler.nombre}</dd>
          </div>
        )}
        {resena.tiempo && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Duración</dt>
            <dd>{resena.tiempo.nombre}</dd>
          </div>
        )}
        {resena.recomienda != null && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">¿Lo alquilaría de nuevo?</dt>
            <dd>{resena.recomienda ? 'Sí' : 'No'}</dd>
          </div>
        )}
        {resena.fecha_inicio_alquiler && (
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">Período</dt>
            <dd>
              {fechaCorta(resena.fecha_inicio_alquiler)}
              {resena.fecha_fin_alquiler ? ` – ${fechaCorta(resena.fecha_fin_alquiler)}` : ''}
            </dd>
          </div>
        )}
      </dl>

      {resena.comentario && <p className="whitespace-pre-wrap break-words text-sm">{resena.comentario}</p>}
      {resena.detalle_dano && (
        <p className="text-sm text-ink-soft">
          <span className="font-semibold text-ink">Detalle del daño. </span>
          {resena.detalle_dano}
        </p>
      )}

      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fotos.map((f) => {
            const src = urlImagen(f.url)
            if (!src) return null
            return (
              <a key={f.id} href={src} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={f.descripcion ?? 'Fotografía de la reseña'}
                  loading="lazy"
                  decoding="async"
                  className="h-28 w-28 rounded-xl border border-line object-cover"
                />
              </a>
            )
          })}
        </div>
      )}

      {puedeDenunciar && (
        <details className="denuncia">
          <summary>Denunciar esta reseña</summary>
          <FormDenuncia resenaId={resena.id} />
        </details>
      )}
    </article>
  )
}
