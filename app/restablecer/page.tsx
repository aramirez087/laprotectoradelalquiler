import { MarcoAcceso } from '@/components/marco-acceso'
import Link from '@/components/enlace'
import { FormClave } from '@/components/form-clave'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { establecerClave } from '@/lib/actions/auth'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requiereSegundoFactor, rutaSegundoFactor } from '@/lib/dos-factores'

export const metadata = { title: 'Nueva clave' }

export default async function RestablecerPage() {
  if (sinSupabase()) {
    return (
      <MarcoAcceso titulo="Elija una clave nueva" texto="Use al menos 8 caracteres, con letras y números.">
        <AvisoConfiguracion />
      </MarcoAcceso>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && await requiereSegundoFactor(supabase, user)) redirect(rutaSegundoFactor('/restablecer'))

  return (
    <MarcoAcceso titulo="Elija una clave nueva" texto="Use al menos 8 caracteres, con letras y números.">
      {user ? (
        <div className="space-y-4">
          <FormClave accion={establecerClave} etiqueta="Guardar clave nueva" anchoCompleto />
          <p className="text-center text-sm text-ink-soft">
            <Link href="/recuperar" className="enlace-texto font-semibold">
              Solicitar otro enlace
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p role="alert" className="aviso aviso-error">Este enlace venció o ya se usó. Solicite uno nuevo para continuar.</p>
          <Link href="/recuperar" className="btn-primario flex w-full">
            Solicitar un enlace nuevo
          </Link>
        </div>
      )}
    </MarcoAcceso>
  )
}
