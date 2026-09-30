import Link from 'next/link'
import { FormClave } from '@/components/form-clave'
import { requireUsuario, listarResenasDe, accesoConsulta, perfilFacebookDe, horaServidor } from '@/lib/dal'
import { PanelPermiso } from '@/components/permiso-consulta'
import { cerrarSesion } from '@/lib/actions/auth'
import {
  authFacebookHabilitado,
  mensajeErrorFacebook,
  RUTA_VINCULAR_FACEBOOK,
  tieneIdentidadFacebook,
} from '@/lib/facebook-auth'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { etiquetaEstado, etiquetaRol, fechaCorta, nombreCompleto, primer } from '@/lib/util'
import { Avatar } from '@/components/avatar'
import { Icono } from '@/components/icono'
import { PerfilFacebook } from '@/components/perfil-facebook'

export const metadata = { title: 'Mi perfil' }

export default async function PerfilPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await props.searchParams
  const enviada = primer(params.enviada) === '1'
  const usuario = await requireUsuario('/perfil')
  const acceso = await accesoConsulta(usuario)
  const consulta = acceso.puede_consultar
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
          <p className="eyebrow">Mi perfil · {etiquetaRol(usuario.rol)}</p>
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
                <PerfilFacebook valor={facebook} etiqueta="Facebook" className="font-semibold text-seal underline-offset-2 hover:underline" />
              )}
            </p>
          )}
        </div>
        <form action={cerrarSesion}>
          <button className="btn-secundario w-full sm:w-auto">Cerrar sesión</button>
        </form>
      </header>

      <nav aria-label="Secciones de mi perfil" className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line pb-3">
        <Link href="#acceso-consultas" className="enlace-texto font-medium">Mi permiso</Link>
        <Link href="#mis-resenas" className="enlace-texto font-medium">Mis reseñas</Link>
        <Link href="#seguridad" className="enlace-texto font-medium">Seguridad</Link>
      </nav>

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
          {' '}El tiempo de consulta se suma cuando se aprueba su reseña sobre otro inquilino; el envío todavía no cambia su permiso.
        </p>
      )}
      <PanelPermiso acceso={acceso} ahoraServidor={horaServidor()} />

      <section id="mis-resenas" aria-labelledby="titulo-mis-resenas" className="scroll-mt-36 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-mis-resenas" className="text-2xl">Mis reseñas{!aviso && misResenas.length > 0 && <span className="ml-2 text-base text-ink-soft">({misResenas.length})</span>}</h2>
          {usuario.activo && misResenas.length > 0 && (
            <Link href="/resenas/nueva" className="btn-secundario w-full sm:w-auto">
              Escribir otra reseña
            </Link>
          )}
        </div>
        <p className="text-sm leading-relaxed text-ink-soft">Aquí puede ver todas sus reseñas, incluso si su permiso venció. Puede tener una sola reseña por inquilino. Otros propietarios y agencias también pueden reseñar a esa persona.</p>
        {aviso ? (
          <div className="expediente space-y-4">
            <p role="alert" className="aviso aviso-error">{aviso} Sus aportes siguen guardados. Intente cargar esta página de nuevo.</p>
            <a href="/perfil#mis-resenas" className="btn-secundario">Volver a cargar mis reseñas</a>
          </div>
        ) : misResenas.length === 0 ? (
          <div className="expediente flex flex-col items-start gap-4 p-6">
            <span className="icono-estado"><Icono nombre="documento" /></span>
            <div>
              <h3 className="text-xl">Su primera experiencia empieza aquí</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {usuario.activo ? 'Todavía no ha escrito reseñas. Sus aportes y el resultado de cada revisión aparecerán en este espacio.' : 'Todavía no hay reseñas en su cuenta. Mientras esté inactiva, no puede enviar nuevos aportes.'}
              </p>
            </div>
            {usuario.activo && (
              <Link href={usuario.rol === 'admin' ? '/admin' : '/registro/resena'} className="btn-primario w-full sm:w-auto">
                {usuario.rol === 'admin' ? 'Ir a administración' : 'Escribir mi primera reseña'}
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {misResenas.map((r) => (
              <li key={r.id} className="expediente space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar nombre={nombreCompleto(r.persona)} tamano="sm" />
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-display text-lg">
                      {consulta ? <Link href={`/fichas/${r.persona.id}`} className="underline-offset-4 hover:underline">{nombreCompleto(r.persona)}</Link> : nombreCompleto(r.persona)}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                      Enviada el <time dateTime={r.creado_en}>{fechaCorta(r.creado_en)}</time>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`chip ${r.estado === 'publicada' ? 'chip-ok' : 'chip-alerta'}`}>{r.estado === 'publicada' ? 'Aprobada' : etiquetaEstado(r.estado)}</span>
                  {r.anonima && <span className="chip">Anónima</span>}
                </div>
                <p className="text-xs leading-relaxed text-ink-soft">
                  {r.estado === 'borrador' ? 'En revisión. Todavía no suma tiempo de consulta.' : r.estado === 'oculta' ? 'No aporta tiempo de consulta.' : 'Publicada. Su reseña sobre este inquilino cuenta una sola vez para su permiso.'}
                </p>
                {r.estado === 'oculta' && r.detalle_verificacion && <p className="rounded-lg bg-alerta-soft p-3 text-sm leading-relaxed text-alerta"><strong className="font-semibold">Motivo de la revisión:</strong> {r.detalle_verificacion}</p>}
                <details className="border-t border-line pt-3">
                  <summary className="min-h-11 content-center cursor-pointer text-sm font-medium text-seal">Leer mi reseña</summary>
                  <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-relaxed">{r.comentario?.trim() || 'Sin comentario.'}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="seguridad" aria-labelledby="titulo-seguridad" className="scroll-mt-36 space-y-4">
        <h2 id="titulo-seguridad" className="text-2xl">Seguridad de su cuenta</h2>
        {ofrecerFacebook && (
          <div className="expediente flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-medium">Entre también con Facebook</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">Conéctelo para usarlo al iniciar sesión en esta misma cuenta.</p>
            </div>
            <a href={RUTA_VINCULAR_FACEBOOK} className="btn-secundario w-full sm:w-auto">Conectar Facebook</a>
          </div>
        )}
        <details id="clave" className="expediente detalles-cuenta scroll-mt-36">
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
