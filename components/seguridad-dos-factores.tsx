'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { CodigoDosFactores } from '@/components/codigo-dos-factores'
import { MensajeForm } from '@/components/mensaje-form'
import { iniciarConfiguracionDosFactores, confirmarConfiguracionDosFactores, cancelarConfiguracionDosFactores,
  desactivarDosFactores, type ConfiguracionDosFactores, type ResultadoDosFactores } from '@/lib/actions/dos-factores'

export function SeguridadDosFactores({ factores, disponible, aviso }: {
  factores: { id: string; nombre: string }[]; disponible: boolean; aviso?: string
}) {
  const [configuracion, setConfiguracion] = useState<ConfiguracionDosFactores | null>(null)
  const [desactivando, setDesactivando] = useState(false)
  const [error, setError] = useState<string>()
  const [pendiente, startTransition] = useTransition()
  const activa = factores.length > 0

  function ejecutar(accion: () => Promise<ResultadoDosFactores>, cancelar = false) {
    setError(undefined)
    startTransition(async () => {
      try {
        const resultado = await accion()
        if (resultado.error) { setError(resultado.error); return }
        if (resultado.configuracion) setConfiguracion(resultado.configuracion)
        if (cancelar) setConfiguracion(null)
      } catch (error) {
        unstable_rethrow(error)
        setError('No pudimos completar la solicitud. Revise su conexión e intente de nuevo.')
      }
    })
  }

  return (
    <div className="expediente space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-medium">Verificación en dos pasos (2FA)</h3>
        <span className={`chip ${activa ? 'chip-ok' : ''}`}>{disponible ? activa ? 'Activada' : 'Opcional' : 'No disponible'}</span>
      </div>
      <p className="text-sm leading-relaxed text-ink-soft">
        {activa ? 'Su cuenta pide un código de su aplicación autenticadora después de iniciar sesión, también al entrar con Facebook.'
          : 'Le sugerimos activarla para proteger su cuenta. Al entrar, además de su clave o Facebook, usará un código de una aplicación autenticadora. Es completamente opcional.'}
      </p>
      <MensajeForm error={error ?? (!disponible ? 'No pudimos consultar la verificación en dos pasos. Vuelva a cargar la página.' : undefined)} mensaje={aviso} />
      {!activa && disponible && !configuracion && <button type="button" disabled={pendiente} className="btn-secundario w-full sm:w-auto"
        onClick={() => ejecutar(iniciarConfiguracionDosFactores)}>{pendiente ? 'Preparando…' : 'Activar verificación en dos pasos'}</button>}
      {configuracion && !activa && <div className="space-y-4 border-t border-line pt-4">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>Abra una aplicación autenticadora, como Google Authenticator, Microsoft Authenticator o su gestor de contraseñas.</li>
          <li>Agregue una cuenta y escanee este código QR.</li>
          <li>Escriba un código de la aplicación para confirmar la activación.</li>
        </ol>
        <Image src={configuracion.qr.startsWith('data:image/svg+xml') ? configuracion.qr : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(configuracion.qr)}`}
          alt="Código QR para agregar La Protectora del Alquiler a su aplicación autenticadora" width={220} height={220} unoptimized className="rounded-lg bg-white p-3" />
        <details className="text-sm">
          <summary className="min-h-11 content-center cursor-pointer font-medium text-seal">No puedo escanear el QR</summary>
          <p className="mt-2 text-ink-soft">Agregue la cuenta manualmente con esta clave. No la comparta.</p>
          <label className="etiqueta-campo mt-3" htmlFor="secreto-autenticador">Clave de configuración</label>
          <input id="secreto-autenticador" type="text" readOnly value={configuracion.secreto} autoComplete="off" spellCheck={false} className="campo font-mono" />
        </details>
        <p className="aviso text-sm">Antes de activar, guarde una copia segura de esta clave o configure la copia de respaldo de su aplicación. La necesitará si pierde su teléfono. Recuperar la clave de su cuenta no elimina la verificación en dos pasos.</p>
        <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); ejecutar(() => confirmarConfiguracionDosFactores(data)) }} className="space-y-4">
          <input type="hidden" name="factorId" value={configuracion.factorId} />
          <CodigoDosFactores />
          <div className="flex flex-wrap gap-3">
            <button disabled={pendiente} className="btn-primario w-full sm:w-auto">{pendiente ? 'Verificando…' : 'Confirmar y activar'}</button>
            <button type="button" disabled={pendiente} className="btn-secundario w-full sm:w-auto" onClick={() => {
              const data = new FormData(); data.set('factorId', configuracion.factorId); ejecutar(() => cancelarConfiguracionDosFactores(data), true)
            }}>Cancelar</button>
          </div>
        </form>
      </div>}
      {activa && !desactivando && <button type="button" className="btn-secundario w-full sm:w-auto" onClick={() => setDesactivando(true)}>Desactivar verificación en dos pasos</button>}
      {activa && desactivando && <form className="space-y-4 border-t border-line pt-4" onSubmit={event => {
        event.preventDefault(); const data = new FormData(event.currentTarget); ejecutar(() => desactivarDosFactores(data))
      }}>
        <p className="text-sm text-ink-soft">Para desactivar este autenticador, confirme con un código actual. Su cuenta tendrá menos protección.</p>
        {factores.length === 1 ? <input type="hidden" name="factorId" value={factores[0].id} /> : <div>
          <label htmlFor="factor-desactivar" className="etiqueta-campo">Autenticador que desea quitar</label>
          <select name="factorId" id="factor-desactivar" className="campo">{factores.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}</select>
        </div>}
        <CodigoDosFactores id="codigo-desactivar" />
        <div className="flex flex-wrap gap-3">
          <button disabled={pendiente} className="btn-secundario w-full sm:w-auto">{pendiente ? 'Verificando…' : 'Confirmar desactivación'}</button>
          <button type="button" disabled={pendiente} className="btn-secundario w-full sm:w-auto" onClick={() => { setDesactivando(false); setError(undefined) }}>Cancelar</button>
        </div>
      </form>}
    </div>
  )
}
