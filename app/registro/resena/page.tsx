import { redirect } from 'next/navigation'
import Link from 'next/link'
import { crearResenaAction } from '@/lib/actions/resenas'
import {
  completarPerfilRegistro,
  listarResenasDe,
  requireUsuario,
} from '@/lib/dal'
import { FormResena } from '@/components/form-resena'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'
import { createAdmin } from '@/lib/supabase/admin'

export const metadata = { title: 'Su primera reseña' }

export default async function RegistroResenaPage() {
  const usuario = await requireUsuario('/registro/resena')

  if (!usuario.activo) {
    return (
      <div className="contenedor max-w-xl space-y-4">
        <h1 className="text-3xl">Su cuenta está inactiva</h1>
        <p className="text-ink-soft">En este momento no puede enviar reseñas.</p>
        <Link href="/perfil" className="btn-secundario">
          Ver mi perfil
        </Link>
      </div>
    )
  }

  if (sinSupabase()) {
    return (
      <div className="contenedor max-w-xl">
        <AvisoConfiguracion />
      </div>
    )
  }

  let yaEnvio = false
  try {
    yaEnvio = (await listarResenasDe(usuario.id)).length > 0
  } catch {
    yaEnvio = false
  }
  if (yaEnvio) redirect('/perfil')

  await completarPerfilRegistro(usuario)

  return (
    <div className="contenedor max-w-3xl space-y-6">
      <div>
        <p className="eyebrow mb-3">Paso 2 de 2</p>
        <h1 className="text-3xl sm:text-4xl">Cuéntenos una experiencia</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Identifique a la persona y cuente qué ocurrió. Administración revisa la reseña antes de abrir la consulta.
        </p>
      </div>
      <FormResena
        primera
        accion={crearResenaAction}
        personaInicial={null}
        enRevision={usuario.rol !== 'admin' && !!createAdmin()}
      />
      <Link href="/perfil" className="text-sm font-semibold text-ink-soft">
        ← Perfil
      </Link>
    </div>
  )
}
