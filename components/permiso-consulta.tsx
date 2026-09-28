'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { accesoEnPantalla, mensajeAcceso, tiempoRestante, tituloAcceso, type AccesoConsulta } from '@/lib/acceso-consulta'
import { Icono } from '@/components/icono'

type Props = { acceso: AccesoConsulta; ahoraServidor: number }

/** Parte del reloj del servidor para no depender de la hora del dispositivo. */
function useReloj(ahoraServidor: number, venceEn: string | null) {
  const [reloj, setReloj] = useState({ base: ahoraServidor, ahora: ahoraServidor })
  useEffect(() => {
    const inicio = performance.now()
    const vencimiento = venceEn ? Date.parse(venceEn) : 0
    let timer: ReturnType<typeof setTimeout>
    function programar() {
      const ahora = ahoraServidor + performance.now() - inicio
      const hastaVencer = vencimiento - ahora
      timer = setTimeout(actualizar, hastaVencer > 0 ? Math.min(60_000, hastaVencer + 1) : 60_000)
    }
    function actualizar() {
      clearTimeout(timer)
      setReloj({ base: ahoraServidor, ahora: ahoraServidor + performance.now() - inicio })
      programar()
    }
    function alVolver() { if (!document.hidden) actualizar() }
    programar()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [ahoraServidor, venceEn])
  return reloj.base === ahoraServidor ? reloj.ahora : ahoraServidor
}

export function FranjaPermiso({ acceso, ahoraServidor }: Props) {
  const router = useRouter()
  const ahora = useReloj(ahoraServidor, acceso.vence_en)
  const actual = accesoEnPantalla(acceso, ahora)

  // Los layouts persisten al navegar. Renueva el estado visible también cuando
  // moderación decide en otra sesión; no hace solicitudes con la pestaña oculta.
  useEffect(() => {
    if (acceso.motivo === 'administracion') return
    let ultimaConsulta = performance.now()
    function actualizar() {
      if (document.hidden || performance.now() - ultimaConsulta < 30_000) return
      ultimaConsulta = performance.now()
      router.refresh()
    }
    function alVolver() {
      if (!document.hidden) {
        ultimaConsulta = performance.now()
        router.refresh()
      }
    }
    const timer = setInterval(actualizar, 60_000)
    window.addEventListener('focus', actualizar)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', actualizar)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [acceso.motivo, ahoraServidor, router])

  useEffect(() => {
    if (acceso.motivo === 'vigente' && actual.motivo === 'vencida') router.refresh()
  }, [acceso.motivo, actual.motivo, router])

  if (actual.motivo === 'administracion') return null
  const activo = actual.motivo === 'vigente'
  return (
    <div className="border-t border-line bg-seal-soft/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-xs sm:px-6">
        <p className="flex items-center gap-2">
          <Icono nombre={activo ? 'reloj' : 'documento'} className="h-4 w-4 shrink-0 text-seal" />
          <span><strong className="font-semibold">{tituloAcceso(actual)}</strong>{activo && actual.vence_en ? ` · ${tiempoRestante(actual.vence_en, ahora)} de acceso` : ''}</span>
        </p>
        <Link href="/perfil#acceso-consultas" className="inline-flex min-h-8 items-center font-semibold text-seal underline underline-offset-4">
          Mi permiso y mis aportes <span aria-hidden="true" className="ml-1">↗</span>
        </Link>
      </div>
    </div>
  )
}

export function PanelPermiso({ acceso, ahoraServidor }: Props) {
  const router = useRouter()
  const [actualizando, startTransition] = useTransition()
  const ahora = useReloj(ahoraServidor, acceso.vence_en)
  const actual = accesoEnPantalla(acceso, ahora)
  const activo = actual.motivo === 'vigente'
  const normal = !['administracion', 'inactiva', 'error'].includes(actual.motivo)
  const dias = actual.vence_en ? (Date.parse(actual.vence_en) - ahora) / 86_400_000 : 0
  const porVencer = activo && dias <= 7
  const esperandoRevision = actual.motivo === 'revision' || (actual.motivo === 'vencida' && actual.pendientes > 0)
  const revisarAportes = esperandoRevision || actual.motivo === 'rechazada'

  return (
    <section id="acceso-consultas" className="expediente scroll-mt-36 space-y-6" aria-labelledby="titulo-permiso">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-permiso" className="text-2xl">Su permiso de consulta</h2>
        <span className={`chip ${activo ? 'chip-ok' : 'chip-alerta'}`}>{tituloAcceso(actual)}</span>
      </div>
      <div>
        {activo && actual.vence_en && (
          <>
            <p className="text-sm text-ink-soft">Tiempo disponible para consultar</p>
            <p className="mt-1 font-display text-4xl font-medium tracking-tight text-seal sm:text-5xl">{tiempoRestante(actual.vence_en, ahora)}</p>
          </>
        )}
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{mensajeAcceso(actual)}</p>
        {porVencer && <p className="mt-3 text-sm font-medium text-alerta">Su acceso vence pronto. Una experiencia distinta, una vez aprobada, puede ampliarlo.</p>}
      </div>
      {normal && (
        <>
          <dl className="grid gap-3 border-y border-line py-5 min-[400px]:grid-cols-3">
            {[
              ['Experiencias aprobadas', actual.aprobadas],
              ['Reseñas en revisión', actual.pendientes],
              ['Reseñas no aprobadas', actual.rechazadas],
            ].map(([label, valor]) => (
              <div key={label} className="flex items-center justify-between gap-3 min-[400px]:flex-col min-[400px]:items-start min-[400px]:gap-1">
                <dt className="text-xs leading-relaxed text-ink-soft min-[400px]:order-2">{label}</dt>
                <dd className="font-display text-2xl tabular-nums min-[400px]:text-3xl">{valor}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-3">
            <p className="text-sm leading-relaxed"><strong className="font-semibold">Una experiencia nueva aprobada = 3 meses.</strong> Puede acumular hasta 12 meses de acceso.</p>
            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-seal">Cómo gana tiempo de consulta</summary>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
              <li><strong className="font-semibold text-ink">3 meses por cada experiencia distinta aprobada.</strong> El tiempo empieza cuando se aprueba, no al enviar la reseña.</li>
              <li>Conserva el tiempo que le queda y puede acumular hasta <strong className="font-semibold text-ink">12 meses</strong> desde la nueva aprobación. Si ya venció, vuelve a empezar con 3 meses.</li>
              <li>Varias reseñas del mismo alquiler cuentan como un solo aporte. Editarlas o reenviarlas no suma tiempo.</li>
              <li>Las experiencias positivas y negativas reciben el mismo reconocimiento. Una reseña rechazada o eliminada deja de contar si era la única publicada de ese alquiler.</li>
              </ul>
            </details>
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {activo && <Link href="/fichas" className="btn-primario">Consultar reseñas</Link>}
        {normal && revisarAportes && (
          <Link href="#mis-resenas" className="btn-primario w-full sm:w-auto">Ver mis reseñas</Link>
        )}
        {normal && !revisarAportes && (
          <Link href={actual.motivo === 'ninguna' ? '/registro/resena' : '/resenas/nueva'} className={activo ? 'btn-secundario' : 'btn-primario'}>
            {actual.motivo === 'ninguna' ? 'Escribir mi primera reseña' : 'Compartir otra experiencia'}
          </Link>
        )}
        {esperandoRevision && <p className="w-full text-xs leading-relaxed text-ink-soft">Su experiencia está en revisión. Puede seguir el resultado más abajo; no necesita enviarla otra vez.</p>}
        <button type="button" disabled={actualizando} onClick={() => startTransition(() => router.refresh())} className="btn-secundario">
          {actualizando ? 'Actualizando…' : 'Actualizar estado'}
        </button>
      </div>
    </section>
  )
}
