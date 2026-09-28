'use client'

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react'
import { migrarLegacyAction } from '@/lib/actions/migracion-legacy'
import { formatoNumero } from '@/lib/util'

function DatoDiagnostico({ etiqueta, valor }: { etiqueta: string; valor: number | null }) {
  return (
    <div className="metrico">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{etiqueta}</dt>
      <dd className="mt-1">{valor == null ? 'No disponible' : formatoNumero(valor)}</dd>
    </div>
  )
}

export function FormMigracionLegacy({ authDisponible }: { authDisponible: boolean }) {
  const [estado, action, pendiente] = useActionState(migrarLegacyAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  const resultadoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!estado?.error && !estado?.mensaje) return
    if (estado.tipo === 'importacion' && estado.resumen) {
      const clave = formRef.current?.elements.namedItem('password')
      if (clave instanceof HTMLInputElement) clave.value = ''
    }
    resultadoRef.current?.focus()
  }, [estado])

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendiente) return
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const datos = new FormData(event.currentTarget, submitter)
    startTransition(() => action(datos))
  }

  const resumen = estado?.resumen
  const totalLookups = resumen
    ? Object.values(resumen.lookups).reduce((total, cantidad) => total + cantidad, 0)
    : 0

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
      <form ref={formRef} action={action} onSubmit={enviar} aria-busy={pendiente} className="expediente space-y-6">
        <fieldset disabled={pendiente} className="space-y-5">
          <legend className="sr-only">Conexión al sistema anterior</legend>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div>
              <label className="etiqueta-campo" htmlFor="legacy-host">Servidor MySQL</label>
              <input id="legacy-host" name="host" className="campo" required maxLength={255} placeholder="mysql.ejemplo.com" autoCapitalize="none" spellCheck={false} />
            </div>
            <div>
              <label className="etiqueta-campo" htmlFor="legacy-port">Puerto</label>
              <input id="legacy-port" name="port" className="campo" required type="number" min="1" max="65535" defaultValue="3306" inputMode="numeric" />
            </div>
          </div>

          <div>
            <label className="etiqueta-campo" htmlFor="legacy-database">Base de datos</label>
            <input id="legacy-database" name="database" className="campo" required maxLength={128} defaultValue="laprotec_laprotectora" autoCapitalize="none" spellCheck={false} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="etiqueta-campo" htmlFor="legacy-user">Usuario de lectura</label>
              <input id="legacy-user" name="user" className="campo" required maxLength={128} autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </div>
            <div>
              <label className="etiqueta-campo" htmlFor="legacy-password">Clave</label>
              <input id="legacy-password" name="password" className="campo" type="password" maxLength={512} autoComplete="new-password" />
            </div>
          </div>

          <p className="text-sm leading-6 text-ink-soft">
            Use una cuenta que solo tenga permiso de lectura. Estos datos se usan para esta operación y no se guardan.
          </p>

          <div className="border-t border-line pt-5">
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-sm font-semibold">
                Accesos de usuarios
                <span aria-hidden="true" className="text-ink-soft group-open:rotate-45">＋</span>
              </summary>
              <label className={`mt-3 flex items-start gap-3 rounded-lg border border-line p-4 text-sm ${authDisponible ? '' : 'opacity-60'}`}>
                <input type="checkbox" name="crearCuentas" className="mt-1" disabled={!authDisponible} />
                <span>
                  <span className="block font-semibold">Crear accesos en Supabase Auth</span>
                  <span className="mt-1 block leading-6 text-ink-soft">
                    Además de perfiles y reseñas, crea el inicio de sesión para las cuentas activas con correo real.
                    {!authDisponible && ' Falta configurar la URL o la clave secreta de Supabase.'}
                  </span>
                </span>
              </label>
            </details>
          </div>

          <label className="flex items-start gap-3 rounded-lg bg-[var(--alerta-soft)] p-4 text-sm">
            <input type="checkbox" name="confirmar" value="si" className="mt-1" />
            <span>
              <span className="block font-semibold">Confirmo la importación al registro actual</span>
              <span className="mt-1 block leading-6 text-ink-soft">El proceso actualiza coincidencias y agrega lo que falte. Si falla la importación de datos, se revierte el lote completo. Los accesos se crean después.</span>
            </span>
          </label>
        </fieldset>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="submit" name="modo" value="probar" disabled={pendiente} className="btn-secundario">
            {pendiente ? 'Procesando…' : 'Probar conexión'}
          </button>
          <button type="submit" name="modo" value="simular" disabled={pendiente} className="btn-secundario">
            {pendiente ? 'Procesando…' : 'Simular importación'}
          </button>
          <button type="submit" name="modo" value="importar" disabled={pendiente} className="btn-primario">
            {pendiente ? 'Importando…' : 'Traer datos'}
          </button>
        </div>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="expediente overflow-hidden p-0">
          <div className="p-5">
            <p className="eyebrow">Recorrido</p>
            <div className="mt-5 grid grid-cols-[1.25rem_1fr] gap-x-3 gap-y-1 text-sm">
              <span className="mt-1.5 size-2.5 rounded-full bg-ink" aria-hidden="true" />
              <div><p className="font-semibold">MySQL anterior</p><p className="mt-1 text-ink-soft">Solo lectura</p></div>
              <span className="ml-[0.27rem] h-10 border-l border-dashed border-line" aria-hidden="true" />
              <span />
              <span className="mt-1.5 size-2.5 rounded-full border-2 border-seal" aria-hidden="true" />
              <div><p className="font-semibold">Registro actual</p><p className="mt-1 text-ink-soft">Postgres / Supabase</p></div>
            </div>
          </div>
          <div className="border-t border-line bg-[color-mix(in_srgb,var(--line)_25%,transparent)] px-5 py-4 text-xs leading-5 text-ink-soft">
            Puede repetir la importación. Las fichas legacy se reconocen por su identificador de origen.
          </div>
        </div>

        {(estado?.error || estado?.mensaje) && (
          <div
            ref={resultadoRef}
            tabIndex={-1}
            role={estado.error ? 'alert' : 'status'}
            className={`space-y-4 rounded-xl border p-5 ${estado.error ? 'border-alerta bg-[var(--alerta-soft)]' : 'border-line bg-card'}`}
          >
            <div>
              <p className="eyebrow">Resultado</p>
              <p className="mt-2 text-sm leading-6">{estado.error ?? estado.mensaje}</p>
            </div>

            {estado.diagnostico && (
              <dl className="grid grid-cols-2 gap-2">
                <DatoDiagnostico etiqueta="Personas" valor={estado.diagnostico.personas} />
                <DatoDiagnostico etiqueta="Fichas" valor={estado.diagnostico.fichas} />
                <DatoDiagnostico etiqueta="Accesos origen" valor={estado.diagnostico.usuarios} />
                <DatoDiagnostico etiqueta="Tablas" valor={estado.diagnostico.tablas} />
              </dl>
            )}

            {resumen && (
              <dl className="grid grid-cols-2 gap-2">
                <DatoDiagnostico etiqueta="Catálogos" valor={totalLookups} />
                <DatoDiagnostico etiqueta="Personas" valor={resumen.personas} />
                <DatoDiagnostico etiqueta="Usuarios" valor={resumen.usuarios} />
                <DatoDiagnostico etiqueta="Reseñas" valor={resumen.resenas} />
              </dl>
            )}

            {estado.observaciones && estado.observaciones.length > 0 && (
              <div className="border-t border-line pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Observaciones</p>
                <ul className="mt-2 space-y-2 text-xs leading-5 text-ink-soft">
                  {estado.observaciones.map((observacion, indice) => <li key={`${indice}-${observacion}`}>{observacion}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
