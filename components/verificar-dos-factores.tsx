'use client'

import { useFormAction } from '@/components/use-form-action'
import { CodigoDosFactores } from '@/components/codigo-dos-factores'
import { MensajeForm } from '@/components/mensaje-form'
import { verificarSegundoFactor } from '@/lib/actions/dos-factores'

export function VerificarDosFactores({ factores, siguiente }: { factores: { id: string; nombre: string }[]; siguiente: string }) {
  const { estado, pendiente, formProps } = useFormAction(verificarSegundoFactor)
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      {factores.length === 1 ? <input type="hidden" name="factorId" value={factores[0].id} /> : <div>
        <label className="etiqueta-campo" htmlFor="factor-verificar">Aplicación autenticadora</label>
        <select id="factor-verificar" name="factorId" className="campo">{factores.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select>
      </div>}
      <CodigoDosFactores />
      <MensajeForm error={estado?.error} />
      <button disabled={pendiente} className="btn-primario w-full">{pendiente ? 'Verificando…' : 'Verificar y entrar'}</button>
    </form>
  )
}
