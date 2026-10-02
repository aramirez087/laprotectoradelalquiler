import { registrarError } from '@/lib/registro-error'
import { redirect } from 'next/navigation'
import Link from '@/components/enlace'
import { crearResenaAction } from '@/lib/actions/resenas'
import {
  completarPerfilRegistro,
  listarResenasDe,
  puedeConsultar,
  requireUsuario,
} from '@/lib/dal'
import { FormResena } from '@/components/form-resena'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'
import { REGLAS_CONSULTA } from '@/lib/acceso-consulta'
import { PasosRegistro } from '@/components/pasos-registro'
import { Icono } from '@/components/icono'
import { obtenerBorradorResena } from '@/lib/borrador-resena-servidor'

export const metadata = { title: 'Mi primera reseña' }

export default async function RegistroResenaPage() {
  const usuario = await requireUsuario('/registro/resena')

  if (!usuario.activo) {
    return (
      <div className="pantalla-estado">
        <span className="icono-estado"><Icono nombre="revisar" /></span>
        <h1 className="mt-6 text-3xl">Su cuenta está inactiva</h1>
        <p className="mb-6 mt-3 text-sm leading-relaxed text-ink-soft">En este momento no puede enviar reseñas. Puede revisar su cuenta y los aportes anteriores en su perfil.</p>
        <Link href="/perfil" className="btn-secundario">
          Ver mi perfil
        </Link>
      </div>
    )
  }

  if (usuario.rol === 'admin') redirect('/admin')

  if (sinSupabase()) {
    return (
      <div className="contenedor max-w-xl space-y-4">
        <h1 className="text-3xl">Mi primera reseña</h1>
        <AvisoConfiguracion />
      </div>
    )
  }

  if (await puedeConsultar(usuario)) redirect('/')

  let yaEnvio = false
  try {
    yaEnvio = (await listarResenasDe(usuario.id)).length > 0
  } catch (error) {
    registrarError('page_load_error', error, { route: '/registro/resena', routeType: 'render' })
    yaEnvio = false
  }
  if (yaEnvio) redirect('/perfil')

  await completarPerfilRegistro(usuario)

  return (
    <div className="contenedor max-w-3xl space-y-6">
      <div>
        <PasosRegistro actual={2} />
        <h1 className="text-3xl sm:text-4xl">Mi primera reseña</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
          Identifique al inquilino y cuente qué ocurrió. Si ambas cédulas se verifican en el padrón del TSE
          y el contenido es apto, la reseña puede publicarse automáticamente. Las demás quedan pendientes de revisión por administración.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">{REGLAS_CONSULTA}</p>
      </div>
      <FormResena
        primera
        accion={crearResenaAction}
        personaInicial={null}
        enRevision
        borrador={await obtenerBorradorResena(usuario.id, null)}
      />
      <Link href="/perfil" className="enlace-atras">
        ← Volver a mi perfil
      </Link>
    </div>
  )
}
