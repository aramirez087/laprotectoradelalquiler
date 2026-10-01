import { correoResenasConfigurado } from '@/lib/correo-resenas'
import { FormEditarResena, FormEliminarResena } from '@/components/admin-formularios'
import { Avatar } from '@/components/avatar'
import { FormDenuncia } from '@/components/form-denuncia'
import { etiquetaEstado, etiquetaRol, fechaCorta, identidadAutorResena } from '@/lib/util'
import type { FilaResenaCompleta } from '@/lib/tipos'

export function TarjetaResena({
  resena,
  puedeDenunciar,
  esAdmin = false,
  persona,
}: {
  resena: FilaResenaCompleta
  puedeDenunciar: boolean
  esAdmin?: boolean
  persona?: {
    id: number
    identificacion: string
    nombre: string
    nombre2: string | null
    apellido1: string
    apellido2: string | null
  }
}) {
  const identidad = identidadAutorResena({
    anonima: resena.anonima,
    esAdmin,
    nombre: resena.autor?.nombre,
    rol: resena.autor?.rol,
  })
  const tieneMarcas = resena.propia || identidad.marcaAnonima || resena.estado !== 'publicada' || resena.verificada

  return (
    <article className="expediente space-y-4 break-words">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:flex-1">
          <Avatar nombre={identidad.nombre} tamano="sm" />
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold">{identidad.nombre}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {identidad.rol && <>{etiquetaRol(identidad.rol)}{resena.creado_en && ' · '}</>}
              {resena.creado_en && <time dateTime={resena.creado_en}>{fechaCorta(resena.creado_en)}</time>}
            </p>
            {resena.anonima && resena.propia && !esAdmin && (
              <p className="text-xs text-ink-soft">Su nombre no aparece en esta reseña.</p>
            )}
          </div>
        </div>
        {tieneMarcas && <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {resena.propia && <span className="chip">Su reseña</span>}
          {identidad.marcaAnonima && <span className="chip">Anónima</span>}
          {resena.estado !== 'publicada' && (
            <span className="chip chip-alerta">{etiquetaEstado(resena.estado)}</span>
          )}
          {resena.verificada && <span className="chip chip-ok">Verificada</span>}
        </div>}
      </div>

      <p className="whitespace-pre-wrap break-words text-sm leading-7">{resena.comentario?.trim() || 'Sin comentario.'}</p>

      {puedeDenunciar && (
        <details className="denuncia border-t border-line pt-2">
          <summary className="flex gap-2">
            <span>Denunciar esta reseña</span>
            <span className="indicador-detalle" aria-hidden="true">+</span>
          </summary>
          <FormDenuncia resenaId={resena.id} />
        </details>
      )}

      {esAdmin && persona && resena.version != null && (
        <div className="space-y-2 border-t border-line pt-3">
          <FormEditarResena
            key={`${resena.id}-${resena.version}`}
            id={resena.id}
            version={resena.version}
            persona={persona}
            comentario={resena.comentario}
            anonima={resena.anonima}
            notificacionesHabilitadas={correoResenasConfigurado()}
          />
          <FormEliminarResena id={resena.id} notificacionesHabilitadas={correoResenasConfigurado()} />
        </div>
      )}
    </article>
  )
}
