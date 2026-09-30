import { cedulaNacional, nombresCoinciden, PADRON_FUENTE, type VerificacionCedula } from '@/lib/cedula'
import { fechaCorta } from '@/lib/util'

export function CedulaAdmin({ identificacion, nombre, verificacion }: { identificacion: string | null | undefined; nombre: string; verificacion?: VerificacionCedula | null }) {
  const cedula = cedulaNacional(identificacion)
  const resultado = cedula && verificacion?.identificacion === cedula ? verificacion : null
  if (resultado?.estado === 'encontrada') {
    const coincide = nombresCoinciden(nombre, resultado.nombre_tse ?? '')
    return <div className="mt-2 space-y-1 text-xs leading-5">
      <span className="chip chip-ok"><span aria-hidden="true">✓</span> Cédula validada en el TSE</span>
      <p className="text-ink-soft">Validación guardada · padrón al {fechaCorta(resultado.fecha_padron)}. <a href={PADRON_FUENTE} target="_blank" rel="noreferrer" className="underline underline-offset-2">Fuente TSE</a></p>
      {!coincide && <p className="text-alerta">El nombre guardado difiere del TSE: <strong>{resultado.nombre_tse}</strong>. Revise antes de aprobar.</p>}
      <p className="text-ink-soft">Confirma el número en el padrón; la identidad de quien lo presenta requiere revisión.</p>
    </div>
  }
  return <p className="mt-2 text-xs text-ink-soft">
    {resultado?.estado === 'no_encontrada' ? `Sin coincidencia en el padrón al ${fechaCorta(resultado.fecha_padron)}. Requiere revisión manual.`
      : !cedula ? 'Documento sin verificación automática del TSE.' : 'Sin validación guardada del TSE.'}
  </p>
}
