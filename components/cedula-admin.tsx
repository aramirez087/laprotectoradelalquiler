import { consultarCedula } from '@/lib/padron'
import { nombresCoinciden, PADRON_FUENTE } from '@/lib/cedula'
import { fechaCorta } from '@/lib/util'

export async function CedulaAdmin({ identificacion, nombre }: { identificacion: string | null | undefined; nombre: string }) {
  const resultado = await consultarCedula(identificacion)
  if (resultado.estado === 'encontrada') {
    const coincide = nombresCoinciden(nombre, resultado.persona.nombreCompleto)
    return <div className="mt-2 space-y-1 text-xs leading-5">
      <span className="chip chip-ok"><span aria-hidden="true">✓</span> Cédula encontrada en el TSE</span>
      <p className="text-ink-soft">Padrón al {fechaCorta(resultado.fechaPadron)}. <a href={PADRON_FUENTE} target="_blank" rel="noreferrer" className="underline underline-offset-2">Fuente TSE</a></p>
      {!coincide && <p className="text-alerta">El nombre guardado difiere del TSE: <strong>{resultado.persona.nombreCompleto}</strong>. Revise antes de aprobar.</p>}
      <p className="text-ink-soft">Confirma el número en el padrón; la identidad de quien lo presenta requiere revisión.</p>
    </div>
  }
  return <p className="mt-2 text-xs text-ink-soft">
    {resultado.estado === 'no_encontrada' ? `Sin coincidencia en el padrón al ${fechaCorta(resultado.fechaPadron)}. Requiere revisión manual.`
      : resultado.estado === 'desactualizado' ? `Padrón desactualizado (${fechaCorta(resultado.fechaPadron)}). Sin verificación automática vigente.`
      : resultado.estado === 'no_aplica' ? 'Documento sin verificación automática del TSE.' : 'Verificación del TSE no disponible.'}
  </p>
}
