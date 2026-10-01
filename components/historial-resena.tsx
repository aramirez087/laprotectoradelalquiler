import type { VersionResena } from '@/lib/tipos'
import { etiquetaEstado, fechaCorta } from '@/lib/util'

export function HistorialResena({ versiones }: { versiones: VersionResena[] }) {
  if (!versiones.length) return null
  return (
    <details className="border-t border-line pt-3">
      <summary className="min-h-11 content-center cursor-pointer text-sm font-medium text-seal">Versiones anteriores ({versiones.length})</summary>
      <p className="mt-2 text-xs text-ink-soft">Se muestran hasta 10 versiones anteriores. El historial solo está disponible para el autor y administración.</p>
      <ol className="mt-4 space-y-4">
        {versiones.map(v => <li key={v.version} className="rounded-lg border border-line p-4">
          <p className="text-xs text-ink-soft">Versión {v.version} · {v.permite_correccion ? 'Corrección solicitada' : etiquetaEstado(v.estado)} · archivada el {fechaCorta(v.guardado_en)}</p>
          <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-relaxed">{v.comentario?.trim() || 'Sin comentario.'}</p>
          <p className="mt-2 text-xs text-ink-soft">{v.anonima ? 'Nombre del autor oculto' : 'Nombre del autor visible'}</p>
          {v.detalle_verificacion && <p className="mt-3 break-words whitespace-pre-wrap text-sm text-ink-soft"><strong className="font-medium">Nota de moderación:</strong> {v.detalle_verificacion}</p>}
        </li>)}
      </ol>
    </details>
  )
}
