import { MarcoAcceso } from '@/components/marco-acceso'
import Link from '@/components/enlace'
import { FormClave } from '@/components/form-clave'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { establecerClave } from '@/lib/actions/auth'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requiereSegundoFactor, rutaSegundoFactor } from '@/lib/dos-factores'
import { destinoInterno, primer } from '@/lib/util'

export const metadata = { title: 'Nueva clave' }

export default async function RestablecerPage(props: PageProps<'/restablecer'>) {
  const siguiente = destinoInterno(primer((await props.searchParams).siguiente), '/')
  const recuperar = `/recuperar?${new URLSearchParams({ siguiente })}`
  if (sinSupabase()) {
    return (
      <MarcoAcceso titulo="Elija una clave nueva" texto="Escriba y confirme su clave nueva para recuperar el acceso a su cuenta.">
        <AvisoConfiguracion />
      </MarcoAcceso>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && await requiereSegundoFactor(supabase, user)) redirect(rutaSegundoFactor(`/restablecer?${new URLSearchParams({ siguiente })}`))

  return (
    <MarcoAcceso titulo="Elija una clave nueva" texto="Escriba y confirme su clave nueva para recuperar el acceso a su cuenta.">
      {user ? (
        <div className="space-y-4">
          {user.email && <p className="break-all text-sm text-ink-soft">Cuenta: <strong className="font-medium text-ink">{user.email}</strong></p>}
          <FormClave accion={establecerClave} etiqueta="Guardar clave nueva" anchoCompleto siguiente={siguiente} correo={user.email} enlaceRecuperacion={recuperar} />
        </div>
      ) : (
        <div className="space-y-4">
          <p role="alert" className="aviso aviso-error">Este enlace venció o ya se usó. Solicite uno nuevo para continuar.</p>
          <Link href={recuperar} className="btn-primario flex w-full">
            Solicitar un enlace nuevo
          </Link>
        </div>
      )}
    </MarcoAcceso>
  )
}
