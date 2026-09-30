'use client'

import { useCallback, useRef } from 'react'
import { useConsultaCedula } from '@/components/use-consulta-cedula'
import { EstadoCedula } from '@/components/estado-cedula'
import { cedulaNacional, type NombrePadron } from '@/lib/cedula'
import { useBorradorAdmin } from '@/components/use-borrador-admin'
import { guardarDatosUsuarioAction } from '@/lib/actions/admin'
import { useFormAction } from '@/components/use-form-action'
import { useAvisoAdmin } from '@/components/avisos-admin'
import { MensajeForm } from '@/components/mensaje-form'
import { ProtectorEdicionAdmin } from '@/components/protector-edicion-admin'

export function FormDatosUsuarioAdmin({ id, nombre, identificacion, telefono, version }: {
  id: number; nombre: string; identificacion: string | null; telefono: string | null; version: string
}) {
  const avisar = useAvisoAdmin()
  const actuales = { nombre, identificacion: identificacion ?? '', telefono: telefono ?? '', version, guardado: false }
  const [borrador, setBorrador, limpiarBorrador] = useBorradorAdmin(`datos:${id}`, { ...actuales, originales: actuales }, (valor) => !valor.guardado && (valor.nombre !== valor.originales.nombre || valor.identificacion !== valor.originales.identificacion || valor.telefono !== valor.originales.telefono))
  const modificado = borrador.nombre !== borrador.originales.nombre || borrador.identificacion !== borrador.originales.identificacion || borrador.telefono !== borrador.originales.telefono
  const valores = borrador.guardado || (!modificado && borrador.version !== version) ? { ...actuales, originales: actuales } : borrador
  const autocompletada = useRef<string | null>(null)
  const alEncontrar = useCallback((persona: NombrePadron) => {
    autocompletada.current = persona.identificacion
    setBorrador(anterior => cedulaNacional(anterior.identificacion) === persona.identificacion
      ? { ...anterior, nombre: persona.nombreCompleto, guardado: false } : anterior)
  }, [setBorrador])
  const consulta = useConsultaCedula(valores.identificacion, alEncontrar)
  const cambio = valores.nombre !== valores.originales.nombre || valores.identificacion !== valores.originales.identificacion || valores.telefono !== valores.originales.telefono
  const versionCambio = cambio && valores.version !== version
  const { estado, pendiente, formProps } = useFormAction(guardarDatosUsuarioAction, {
    onResultado: resultado => {
      if (resultado?.mensaje) {
        limpiarBorrador()
        setBorrador(anterior => ({ ...anterior, guardado: true }))
        avisar(resultado, { enfocar: true })
      }
    },
  })
  const campos = [
    { name: 'nombre', label: 'Nombre completo', maxLength: 150, required: true, type: 'text' },
    { name: 'identificacion', label: 'Cédula · opcional', maxLength: 30, required: false, type: 'text' },
    { name: 'telefono', label: 'Teléfono · opcional', maxLength: 30, required: false, type: 'tel' },
  ] as const
  return (
    <>
    <form {...formProps} className="space-y-5" aria-label={`Datos de ${nombre}`}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={valores.version} />
      <fieldset disabled={pendiente} className="grid gap-5 sm:grid-cols-2">
        {versionCambio && <div className="aviso aviso-error sm:col-span-2" role="alert" tabIndex={-1}><p>Esta cuenta cambió mientras usted editaba. Sus datos sin guardar se conservaron. Cargue la versión actual antes de continuar.</p><button type="button" className="enlace-texto" onClick={() => setBorrador({ ...actuales, originales: actuales })}>Cargar datos actuales</button></div>}
        {campos.map(campo => {
          const error = estado?.campos?.[campo.name]
          return (
            <div key={campo.name} className={campo.name === 'nombre' ? 'sm:col-span-2' : undefined}>
              <label htmlFor={`cuenta-${campo.name}`} className="etiqueta-campo">{campo.label}</label>
              <input id={`cuenta-${campo.name}`} name={campo.name} type={campo.type} className="campo"
                value={valores[campo.name]} onChange={e => {
                  const valor = e.target.value
                  const limpiar = campo.name === 'identificacion' && autocompletada.current && cedulaNacional(valor) !== autocompletada.current
                  if (limpiar) autocompletada.current = null
                  setBorrador({ ...valores, ...(limpiar ? { nombre: '' } : {}), [campo.name]: valor, guardado: false })
                }} readOnly={campo.name === 'nombre' && consulta.estado === 'encontrada'} required={campo.required} maxLength={campo.maxLength}
                minLength={campo.name === 'nombre' ? 3 : undefined} autoComplete="off"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `cuenta-error-${campo.name}` : campo.name === 'identificacion' ? 'cuenta-documento-ayuda' : undefined} />
              {error && <p id={`cuenta-error-${campo.name}`} className="mt-2 text-sm text-alerta">{error}</p>}
              {campo.name === 'identificacion' && <EstadoCedula resultado={consulta} />}
              {campo.name === 'identificacion' && <p id="cuenta-documento-ayuda" className="mt-2 text-sm text-ink-soft">Use de 6 a 12 dígitos; puede incluir guiones. Puede conservar un documento histórico sin modificarlo.</p>}
            </div>
          )
        })}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button className="btn-primario" disabled={pendiente || !cambio || versionCambio}>{pendiente ? 'Guardando…' : 'Guardar datos'}</button>
          <button type="button" className="btn-secundario" disabled={pendiente || !cambio} onClick={() => setBorrador({ ...actuales, originales: actuales })}>Cancelar cambios</button>
          <p className="text-sm text-ink-soft" aria-live="polite">{cambio ? 'Hay cambios sin guardar.' : 'Sin cambios pendientes.'}</p>
        </div>
      </fieldset>
      <MensajeForm error={estado?.error} />
    </form>
    <ProtectorEdicionAdmin pendiente={cambio} nombre={nombre} />
    </>
  )
}
