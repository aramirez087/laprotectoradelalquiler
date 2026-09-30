import type { ResultadoCedula } from '@/lib/cedula'
import { fechaCorta } from '@/lib/util'

export type ConsultaEnCurso = ResultadoCedula | { estado: 'pendiente' | 'incompleta' | 'limite' }

export function EstadoCedula({ resultado }: { resultado: ConsultaEnCurso }) {
  if (resultado.estado === 'incompleta') return null
  const mensaje = resultado.estado === 'encontrada'
    ? `Cédula encontrada en el TSE · padrón al ${fechaCorta(resultado.fechaPadron)}`
    : resultado.estado === 'pendiente' ? 'Consultando cédula en el padrón del TSE…'
    : resultado.estado === 'no_encontrada' ? `No aparece en el padrón al ${fechaCorta(resultado.fechaPadron)}. Revise los datos o complete el nombre manualmente.`
    : resultado.estado === 'desactualizado' ? `El padrón disponible es del ${fechaCorta(resultado.fechaPadron)} y requiere actualización. Complete el nombre manualmente.`
    : resultado.estado === 'no_aplica' ? 'La consulta automática cubre cédulas nacionales de 9 dígitos. Para otros documentos, complete el nombre manualmente.'
    : resultado.estado === 'limite' ? 'Alcanzó el límite de consultas. Puede completar el nombre manualmente e intentar de nuevo en 10 minutos.'
    : 'La consulta del TSE no está disponible. Puede completar el nombre manualmente.'
  return (
    <div role="status" aria-live="polite" aria-busy={resultado.estado === 'pendiente'} className="mt-2 space-y-1 text-xs leading-5">
      <p className={resultado.estado === 'encontrada' ? 'font-medium text-seal' : 'text-ink-soft'}>
        {resultado.estado === 'pendiente' && <span aria-hidden="true" className="rueda-carga mr-2" />}
        {resultado.estado === 'encontrada' && <span aria-hidden="true" className="mr-1 text-green-700">✓</span>}{mensaje}
      </p>
      {resultado.estado === 'encontrada' && <p className="text-ink-soft">El número y el nombre constan en el padrón. La identidad de quien lo presenta requiere revisión.</p>}
    </div>
  )
}
