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
      <p className="text-sm text-ink-soft">Indique qué debe revisar administración sobre esta reseña.</p>
      <div>
        <label className="etiqueta-campo" htmlFor={`motivo-${resenaId}`}>
          Motivo de la denuncia *
        </label>
        <select id={`motivo-${resenaId}`} name="motivo" className="campo" required defaultValue="">
          <option value="" disabled>Seleccione un motivo</option>
          <option value="informacion_falsa">Información falsa</option>
          <option value="difamacion">Difamación</option>
          <option value="datos_incorrectos">Datos incorrectos</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <div>
        <label className="etiqueta-campo" htmlFor={`detalle-${resenaId}`}>
          Más información (opcional)
        </label>
        <textarea
          id={`detalle-${resenaId}`}
          name="detalle"
          rows={3}
          maxLength={2000}
          className="campo"
          placeholder="Explique qué información considera incorrecta y por qué."
          aria-describedby={`ayuda-denuncia-${resenaId}`}
        />
        <p id={`ayuda-denuncia-${resenaId}`} className="mt-2 text-xs text-ink-soft">Hasta 2.000 caracteres. Evite incluir datos personales innecesarios.</p>
      </div>
      <MensajeForm error={estado?.error} mensaje={estado?.mensaje} />
      <button type="submit" disabled={pendiente} className="btn-secundario w-full sm:w-auto">
        {pendiente ? 'Enviando…' : 'Enviar denuncia'}
      </button>
    </form>
  )
}
