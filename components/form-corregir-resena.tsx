'use client'

import { useState } from 'react'
import { corregirResenaAction } from '@/lib/actions/resenas'
import { useFormAction } from '@/components/use-form-action'
import { MensajeForm } from '@/components/mensaje-form'
import type { EstadoForm } from '@/lib/actions/auth'

export function FormCorregirResena({ id, version, comentario, anonima, accion = corregirResenaAction }: {
  id: number; version: number; comentario: string | null; anonima: boolean
  accion?: (estado: EstadoForm, datos: FormData) => Promise<EstadoForm>
}) {
  const { estado, pendiente, formProps } = useFormAction(accion)
  const [relato, setRelato] = useState(comentario ?? '')
  const campo = `correccion-${id}`
  const error = estado?.campos?.comentario
  return (
    <details className="border-t border-line pt-3">
      <summary className="min-h-11 content-center cursor-pointer text-sm font-medium text-seal">Corregir y reenviar</summary>
      <form {...formProps} className="mt-4 space-y-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={version} />
        <p className="text-sm leading-relaxed text-ink-soft">
          Siga las indicaciones de administración. Puede cambiar el relato y el anonimato;
          la identidad del inquilino solo puede corregirla administración.
        </p>
        <div>
          <label htmlFor={campo} className="etiqueta-campo">Su experiencia corregida *</label>
          <textarea id={campo} name="comentario" required rows={6} minLength={30} maxLength={5000}
            value={relato} onChange={e => setRelato(e.target.value)} className="campo"
            aria-invalid={!!error} aria-describedby={`${campo}-ayuda${error ? ` ${campo}-error` : ''}`} />
          {error && <p id={`${campo}-error`} className="mt-2 text-sm text-alerta">{error}</p>}
          <div id={`${campo}-ayuda`} className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-ink-soft">
            <span>Entre 30 y 5.000 caracteres. Describa hechos concretos y evite datos personales innecesarios.</span>
            <span className="tabular-nums">{relato.length.toLocaleString('es-CR')} / 5.000</span>
          </div>
        </div>
        <label htmlFor={`${campo}-anonima`} className="opcion-rol flex items-start gap-3">
          <input id={`${campo}-anonima`} name="anonima" type="checkbox" value="1" defaultChecked={anonima} className="mt-0.5 h-5 w-5 shrink-0" />
          <span><span className="block text-sm font-medium">Ocultar mi nombre</span><span className="mt-1 block text-xs text-ink-soft">Otros usuarios no ven su nombre. Administración sí identifica su cuenta. Evite escribir su nombre en el relato.</span></span>
        </label>
        <MensajeForm error={estado?.error} />
        {estado?.error && <a href="/perfil#mis-resenas" className="enlace-texto">Volver a cargar el estado de mis reseñas</a>}
        <p className="text-xs leading-relaxed text-ink-soft">Se conserva la misma reseña y su historial. La corrección puede publicarse automáticamente si ambas cédulas se verifican en el TSE y el contenido es apto; en los demás casos, administración la revisará. Su primera aprobación le da 3 meses de consulta; si ya fue aprobada antes, volver a aprobarla no suma meses.</p>
        <button type="submit" disabled={pendiente} className="btn-primario w-full sm:w-auto">{pendiente ? 'Reenviando…' : 'Reenviar reseña'}</button>
      </form>
    </details>
  )
}
