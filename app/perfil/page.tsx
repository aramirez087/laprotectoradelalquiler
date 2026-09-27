import Link from 'next/link'
import { FormClave } from '@/components/form-clave'
import { requireUsuario, listarResenasDe } from '@/lib/dal'
import { cerrarSesion } from '@/lib/actions/auth'
import { etiquetaEstado, etiquetaRol, fechaCorta, nombreCompleto, primer } from '@/lib/util'
import { CalificacionEstrellas } from '@/components/calificacion-estrellas'
import { Avatar } from '@/components/avatar'
import { sinSupabase } from '@/lib/supabase/server'

export const metadata = { title: 'Mi perfil' }

export default async function PerfilPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const enviada = primer((await props.searchParams).enviada) === '1'
  const usuario = await requireUsuario()
  const sinBackend = sinSupabase()
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
          <h1 className="mt-1 truncate text-4xl">{usuario.nombre}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {usuario.email}
            {usuario.creado_en ? ` · desde ${fechaCorta(usuario.creado_en)}` : ''}
          </p>
        </div>
        <form action={cerrarSesion}>
          <button className="btn-secundario">Cerrar sesión</button>
        </form>
      </header>

      {enviada && <p className="aviso aviso-ok">La reseña quedó en revisión.</p>}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-2xl">Mis reseñas</h2>
          <Link href="/resenas/nueva" className="btn-primario">
            Escribir
          </Link>
        </div>
        {aviso && <p className="aviso aviso-error">{aviso}</p>}
        {!aviso && misResenas.length === 0 ? (
          <div className="expediente space-y-3">
            <p className="text-ink-soft">Todavía no ha escrito reseñas.</p>
            <Link href="/resenas/nueva" className="btn-primario">
              Escribir la primera
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {misResenas.map((r) => (
              <li key={r.id}>
                <Link href={`/fichas/${r.persona.id}`} className="expediente flex items-center gap-3">
                  <Avatar nombre={nombreCompleto(r.persona)} tamano="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-xl">{nombreCompleto(r.persona)}</p>
                    <p className="text-xs text-ink-soft">
                      {fechaCorta(r.creado_en)}
                      {r.estado === 'oculta' && r.detalle_verificacion ? ` · ${r.detalle_verificacion}` : ''}
                    </p>
                  </div>
                  <CalificacionEstrellas valor={r.calificacion?.valor ?? null} />
                  {r.estado !== 'publicada' && <span className="chip chip-alerta">{etiquetaEstado(r.estado)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="clave" className="space-y-3">
        <h2 className="text-2xl">Clave</h2>
        <FormClave />
      </section>
    </div>
  )
}
