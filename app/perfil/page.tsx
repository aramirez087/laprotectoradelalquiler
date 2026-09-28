import Link from 'next/link'
import { FormClave } from '@/components/form-clave'
import { requireUsuario, listarResenasDe, puedeConsultar, perfilFacebookDe } from '@/lib/dal'
import { cerrarSesion } from '@/lib/actions/auth'
import {
  authFacebookHabilitado,
  mensajeErrorFacebook,
  RUTA_VINCULAR_FACEBOOK,
  tieneIdentidadFacebook,
} from '@/lib/facebook-auth'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { etiquetaEstado, etiquetaRol, fechaCorta, nombreCompleto, primer } from '@/lib/util'
import { CalificacionEstrellas } from '@/components/calificacion-estrellas'
import { Avatar } from '@/components/avatar'

export const metadata = { title: 'Mi perfil' }

export default async function PerfilPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await props.searchParams
  const enviada = primer(params.enviada) === '1'
  const usuario = await requireUsuario('/perfil')
  const consulta = await puedeConsultar(usuario)
  const facebook = await perfilFacebookDe(usuario.id)
  const sinBackend = sinSupabase()
  const facebookAuth = authFacebookHabilitado()
  const avisoFacebook = mensajeErrorFacebook(primer(params.error), facebookAuth)
  const facebookConectado = facebookAuth && primer(params.facebook) === 'conectado'
  let ofrecerFacebook = false
  if (facebookAuth && !sinBackend) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    ofrecerFacebook = !tieneIdentidadFacebook(user)
  }
  let misResenas: Awaited<ReturnType<typeof listarResenasDe>> = []
  let aviso: string | null = null

  if (!sinBackend) {
    try {
      misResenas = await listarResenasDe(usuario.id)
    } catch {
      aviso = 'No pudimos cargar sus reseñas.'
    }
  }

  return (
    <div className="contenedor max-w-3xl space-y-8">
      <header className="expediente flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar nombre={usuario.nombre} fotoUrl={usuario.avatar_url} tamano="lg" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{etiquetaRol(usuario.rol)}</p>
          <h1 className="mt-1 break-words text-3xl sm:text-4xl">{usuario.nombre}</h1>
          <p className="mt-1 break-words text-sm text-ink-soft">
            {usuario.email}
            {usuario.creado_en ? ` · desde ${fechaCorta(usuario.creado_en)}` : ''}
          </p>
          {(usuario.identificacion || facebook) && (
            <p className="mt-1 break-words text-sm text-ink-soft">
              {usuario.identificacion ? `Cédula ${usuario.identificacion}` : null}
              {usuario.identificacion && facebook ? ' · ' : null}
              {facebook && (
                <a href={facebook} target="_blank" rel="noopener noreferrer" className="font-semibold text-seal underline-offset-2 hover:underline">
                  Facebook
                  <span className="sr-only"> (se abre en una pestaña nueva)</span>
                </a>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {ofrecerFacebook && (
            <a href={RUTA_VINCULAR_FACEBOOK} className="btn-secundario">
              Conectar Facebook
            </a>
          )}
          <form action={cerrarSesion}>
            <button className="btn-secundario">Cerrar sesión</button>
          </form>
        </div>
      </header>

      {avisoFacebook && (
        <p role="alert" className="aviso aviso-error">
          {avisoFacebook}
        </p>
      )}
      {facebookConectado && (
        <p role="status" className="aviso aviso-ok">
          Facebook quedó conectado. Puede usarlo para entrar.
        </p>
      )}

      {enviada && (
        <p role="status" className="aviso aviso-ok">
          Recibimos su reseña. Puede seguir su estado en «Mis reseñas».
        </p>
      )}
      {usuario.rol === 'admin' && usuario.activo && (
        <p className="aviso aviso-ok">Su cuenta de administración no necesita una reseña para acceder.</p>
      )}
      {!consulta && usuario.activo && (
        <p className="text-sm text-ink-soft">
          Cuando administración apruebe una reseña, puede consultar reseñas.
        </p>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl">Mis reseñas</h2>
          <Link href="/resenas/nueva" className="btn-primario">
            Escribir reseña
          </Link>
        </div>
        {aviso && <p className="aviso aviso-error">{aviso}</p>}
        {!aviso && misResenas.length === 0 ? (
          <div className="expediente space-y-3">
            <p className="text-ink-soft">Todavía no ha escrito reseñas.</p>
            <Link href={usuario.rol === 'admin' ? '/admin' : '/registro/resena'} className="btn-primario">
              {usuario.rol === 'admin' ? 'Ir a administración' : 'Escribir la primera'}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {misResenas.map((r) => {
              const cuerpo = (
                <>
                  <Avatar nombre={nombreCompleto(r.persona)} tamano="sm" />
                  <div className="min-w-[55%] flex-1">
                    <p className="break-words font-display text-lg">{nombreCompleto(r.persona)}</p>
                    <p className="text-xs text-ink-soft">
                      {fechaCorta(r.creado_en)}
                      {r.estado === 'oculta' && r.detalle_verificacion ? ` · ${r.detalle_verificacion}` : ''}
                    </p>
                  </div>
                  <CalificacionEstrellas valor={r.calificacion?.valor ?? null} />
                  {r.anonima && <span className="chip">Anónima</span>}
                  {r.estado !== 'publicada' && (
                    <span className="chip chip-alerta">{etiquetaEstado(r.estado)}</span>
                  )}
                </>
              )
              return (
                <li key={r.id}>
                  {consulta ? (
                    <Link
                      href={`/fichas/${r.persona.id}`}
                      className="expediente flex flex-wrap items-center gap-3"
                    >
                      {cuerpo}
                    </Link>
                  ) : (
                    <div className="expediente flex flex-wrap items-center gap-3">{cuerpo}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section id="clave" className="space-y-3">
        <details className="expediente detalles-cuenta">
          <summary className="flex cursor-pointer items-center justify-between gap-4">
            <span className="text-lg font-medium">Cambiar clave</span>
            <span aria-hidden="true" className="indicador-detalle">
              +
            </span>
          </summary>
          <div className="mt-5">
            <FormClave />
          </div>
        </details>
      </section>
    </div>
  )
}
