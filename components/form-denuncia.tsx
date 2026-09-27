'use client'

import { useFormAction } from '@/components/use-form-action'
import { denunciar } from '@/lib/actions/denuncias'
import { MensajeForm } from '@/components/mensaje-form'

export function FormDenuncia({ resenaId }: { resenaId: number }) {
  const { estado, pendiente, formProps } = useFormAction(denunciar)

  if (estado?.mensaje) return (
    <form {...formProps}><MensajeForm mensaje={estado.mensaje} /></form>
  )

  return (
    <form {...formProps} className="max-w-md space-y-3">
      <input type="hidden" name="resenaId" value={resenaId} />
      <div>
        <label className="etiqueta-campo" htmlFor={`motivo-${resenaId}`}>
          Motivo
        </label>
        <select id={`motivo-${resenaId}`} name="motivo" className="campo" required>
          <option value="informacion_falsa">Información falsa</option>
          <option value="difamacion">Difamación</option>
          <option value="datos_incorrectos">Datos incorrectos</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor={`detalle-${resenaId}`}>
          Detalle, si quiere explicarlo
        </label>
        <textarea
          id={`detalle-${resenaId}`}
          name="detalle"
          rows={3}
          maxLength={2000}
          className="campo"
          placeholder="Qué está mal y cómo lo sabe."
        />
      </div>
      <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      <button disabled={pendiente} className="btn-secundario">
        {pendiente ? 'Enviando…' : 'Enviar denuncia'}
      </button>
    </form>
  )
}
