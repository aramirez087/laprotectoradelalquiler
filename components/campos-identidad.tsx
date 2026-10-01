'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConsultaCedula } from '@/components/use-consulta-cedula'
import { EstadoCedula } from '@/components/estado-cedula'
import { cedulaNacional, type NombrePadron } from '@/lib/cedula'

type Datos = { identificacion: string; nombre: string; nombre2: string; apellido1: string; apellido2: string }
const VACIOS: Datos = { identificacion: '', nombre: '', nombre2: '', apellido1: '', apellido2: '' }

export function CamposIdentidad({ tipo = 'persona', inicial, errores, idBase = '', campoCedula = 'identificacion', requerida = true, consultarPadron = true, onCambio }: {
  tipo?: 'persona' | 'cuenta'
  inicial?: Partial<Datos>
  errores?: Record<string, string>
  idBase?: string
  campoCedula?: 'identificacion' | 'cedula'
  requerida?: boolean
  consultarPadron?: boolean
  onCambio?: () => void
}) {
  const [datos, setDatos] = useState<Datos>({ ...VACIOS, ...inicial })
  const cedulaActual = useRef(cedulaNacional(inicial?.identificacion))
  const autocompletada = useRef<string | null>(null)
  const anteriores = useRef(datos)
  useEffect(() => {
    if (anteriores.current !== datos) { anteriores.current = datos; onCambio?.() }
  }, [datos, onCambio])
  const alEncontrar = useCallback((persona: NombrePadron) => {
    if (cedulaActual.current !== persona.identificacion) return
    autocompletada.current = persona.identificacion
    setDatos(anterior => ({ ...anterior, ...persona, identificacion: anterior.identificacion, nombre: tipo === 'cuenta' ? persona.nombreCompleto : persona.nombre }))
  }, [tipo])
  const resultado = useConsultaCedula(consultarPadron ? datos.identificacion : '', alEncontrar)
  const encontrada = resultado.estado === 'encontrada'
  const campos = tipo === 'cuenta'
    ? [{ name: 'nombre', label: 'Nombre completo', requerido: true } as const]
    : [
      { name: 'nombre', label: 'Nombre *', requerido: true },
      { name: 'nombre2', label: 'Segundo nombre', requerido: false },
      { name: 'apellido1', label: 'Primer apellido *', requerido: true },
      { name: 'apellido2', label: 'Segundo apellido', requerido: false },
    ] as const
  const idCedula = `${idBase}${campoCedula}`
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="etiqueta-campo" htmlFor={idCedula}>{tipo === 'cuenta' ? 'Número de cédula' : 'Cédula del inquilino *'}</label>
        <input id={idCedula} name={campoCedula} required={requerida} className="campo" placeholder="1-0234-0567"
          autoComplete="off" spellCheck={false} inputMode="numeric" maxLength={30}
          value={datos.identificacion} aria-invalid={!!errores?.[campoCedula]} aria-describedby={`${idCedula}-ayuda${consultarPadron ? ` ${idCedula}-estado` : ''}${errores?.[campoCedula] ? ` ${idCedula}-error` : ''}`}
          onChange={e => {
            const identificacion = e.target.value
            cedulaActual.current = cedulaNacional(identificacion)
            const limpiar = autocompletada.current && cedulaNacional(identificacion) !== autocompletada.current
            if (limpiar) autocompletada.current = null
            setDatos(anterior => ({ ...(limpiar ? VACIOS : anterior), identificacion }))
          }} />
        {errores?.[campoCedula] && <p id={`${idCedula}-error`} className="mt-2 text-sm text-alerta">{errores[campoCedula]}</p>}
        <p id={`${idCedula}-ayuda`} className="mt-2 text-xs text-ink-soft">Puede escribirla con o sin guiones. La cédula completa no se muestra al público.</p>
        {consultarPadron && <div id={`${idCedula}-estado`}><EstadoCedula resultado={resultado} /></div>}
      </div>
      {campos.map(campo => <div key={campo.name} className={tipo === 'cuenta' ? 'sm:col-span-2' : undefined}>
        <label className="etiqueta-campo" htmlFor={`${idBase}${campo.name}`}>{campo.label}</label>
        <input id={`${idBase}${campo.name}`} name={campo.name} required={campo.requerido} className="campo"
          minLength={campo.requerido ? 1 : undefined} maxLength={tipo === 'cuenta' ? 150 : 100} autoComplete="off"
          value={datos[campo.name]} readOnly={encontrada} aria-invalid={!!errores?.[campo.name]}
          aria-describedby={errores?.[campo.name] ? `${idBase}error-${campo.name}` : undefined}
          onChange={e => setDatos(anterior => ({ ...anterior, [campo.name]: e.target.value }))} />
        {errores?.[campo.name] && <p id={`${idBase}error-${campo.name}`} className="mt-2 text-sm text-alerta">{errores[campo.name]}</p>}
      </div>)}
    </div>
  )
}
