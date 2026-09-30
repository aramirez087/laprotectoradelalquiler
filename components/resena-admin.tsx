import { correoResenasConfigurado } from '@/lib/correo-resenas'
import Link from 'next/link'
import { FormDecision, FormEditarResena, FormEliminarResena } from '@/components/admin-formularios'
import { CalificacionEstrellas } from '@/components/calificacion-estrellas'
import { PerfilFacebook } from '@/components/perfil-facebook'
import type { FilaAdminResena } from '@/lib/admin'
import { etiquetaEstado, fechaCorta, nombreCompleto } from '@/lib/util'
import type { EstadoResena } from '@/lib/tipos'

function decisionesDe(estado: EstadoResena): Array<'publicar' | 'rechazar' | 'revisar'> {
  if (estado === 'borrador') return ['publicar', 'rechazar']
  if (estado === 'oculta') return ['publicar', 'revisar']
  return ['rechazar']
}

export function ResenaAdmin({ fila, nivelTitulo = 2 }: { fila: FilaAdminResena; nivelTitulo?: 2 | 3 }) {
  const nombre = nombreCompleto(fila.persona)
  const Titulo = nivelTitulo === 3 ? 'h3' : 'h2'
  const notificacionesHabilitadas = correoResenasConfigurado()

  return (
    <article className="expediente space-y-5" aria-labelledby={`resena-${fila.id}`}>
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Reseña #{fila.id} · {fechaCorta(fila.creado_en)}</p>
          <Titulo id={`resena-${fila.id}`} className="text-xl"><Link href={`/fichas/${fila.persona.id}`} className="break-words text-seal underline-offset-4 hover:underline">{nombre}</Link></Titulo>
          <p className="mt-1 text-sm text-ink-soft">Cédula del inquilino: {fila.persona.identificacion}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:max-w-56 sm:flex-col sm:items-end">
          <span className={fila.estado === 'publicada' ? 'chip chip-ok' : fila.estado === 'oculta' ? 'chip chip-alerta' : 'chip'}>{etiquetaEstado(fila.estado)}</span>
          <CalificacionEstrellas valor={fila.calificacion?.valor ?? null} texto={fila.calificacion?.texto} />
        </div>
      </div>
      <dl className="grid gap-4 rounded-lg bg-paper p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-ink-soft">Escrita por</dt><dd className="mt-1 font-medium">{fila.autor?.nombre ?? 'Sin autor registrado'}</dd>
          {fila.autor?.identificacion && <dd className="mt-1 text-xs text-ink-soft">Cédula: {fila.autor.identificacion}</dd>}
          {fila.autor?.facebook && <dd className="mt-1"><PerfilFacebook valor={fila.autor.facebook} className="text-seal underline underline-offset-2" /></dd>}
          {fila.anonima && <dd className="mt-1 text-xs text-ink-soft">El nombre del autor no se muestra en la ficha.</dd>}
        </div>
        <div><dt className="text-xs text-ink-soft">Inicio del alquiler</dt><dd className="mt-1">{fila.fecha_inicio_alquiler ? fila.fecha_inicio_alquiler.split('-').reverse().join('/') : 'Sin fecha registrada'}</dd></div>
      </dl>
      <div><p className="eyebrow mb-2">Experiencia compartida</p><p className="whitespace-pre-wrap text-sm leading-7">{fila.comentario?.trim() || 'Sin comentario.'}</p></div>
      {fila.detalle_verificacion && <div className="border-l-2 border-line pl-4"><p className="etiqueta-campo">Última nota de moderación</p><p className="whitespace-pre-wrap text-sm leading-6 text-ink-soft">{fila.detalle_verificacion}</p></div>}
      <div className="border-t border-line pt-5"><FormDecision id={fila.id} decisiones={decisionesDe(fila.estado)} notificacionesHabilitadas={notificacionesHabilitadas} /></div>
      <div className="space-y-2 border-t border-line pt-4">
        <FormEditarResena
          key={`${fila.id}-${fila.persona.id}-${fila.comentario ?? ''}-${fila.anonima ? 1 : 0}`}
          id={fila.id}
          persona={fila.persona}
          comentario={fila.comentario}
          anonima={fila.anonima}
          notificacionesHabilitadas={notificacionesHabilitadas}
        />
        <FormEliminarResena id={fila.id} notificacionesHabilitadas={notificacionesHabilitadas} />
      </div>
    </article>
  )
}
