import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cerrarSesion } from '@/lib/actions/auth'
import { MarcoAcceso } from '@/components/marco-acceso'
import { RegistroFacebookForm } from '@/components/registro-facebook-form'
import { altaFacebookLista, previaAltaFacebook } from '@/lib/facebook-alta'
import { authFacebookHabilitado, cuentaCreadaConFacebook, esRutaDeAltaFacebook, nombreDesdeFacebook } from '@/lib/facebook-auth'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { destinoInterno, primer } from '@/lib/util'

export async function generateMetadata(): Promise<Metadata> {
  if (!authFacebookHabilitado()) return {}
  return { title: 'Completar cuenta' }
}

export default async function RegistroFacebookPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!authFacebookHabilitado() || sinSupabase()) redirect('/registro')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!cuentaCreadaConFacebook(user)) redirect('/registro')

  const pedido = destinoInterno(primer((await props.searchParams).siguiente))
  const siguiente = esRutaDeAltaFacebook(pedido.split('?')[0] ?? '') ? '/fichas' : pedido
  if (await altaFacebookLista(user.id)) redirect(siguiente)

  const email = user.email?.trim().toLowerCase() ?? ''
  if (!email) {
    return (
      <MarcoAcceso titulo="Falta un correo confirmado" texto="Facebook no compartió un correo confirmado para esta cuenta.">
        <p className="text-sm text-ink-soft">
          Confirme un correo en Facebook y vuelva a intentar el ingreso. También puede crear una cuenta con correo y clave.
        </p>
        <form action={cerrarSesion}>
          <button type="submit" className="btn-secundario mt-4 w-full">Cerrar sesión para volver a empezar</button>
        </form>
      </MarcoAcceso>
    )
  }
  const previa = await previaAltaFacebook(user.id, email)

  return (
    <MarcoAcceso
      titulo="Complete su cuenta"
      texto="Facebook confirmó su entrada. Revise sus datos para continuar a su primera experiencia."
      pasoRegistro={1}
    >
      <p className="mb-6 rounded-xl border border-seal/20 bg-seal-soft px-4 py-3 text-sm leading-relaxed text-seal">
        Su primera experiencia aprobada le da <strong className="font-semibold">3 meses para consultar reseñas</strong>.
      </p>
      <RegistroFacebookForm
        nombre={nombreDesdeFacebook(user.user_metadata)}
        email={email}
        cedula={previa?.cedula ?? ''}
        facebook={previa?.facebook ?? ''}
        pedirRol={!previa?.existe}
      />
    </MarcoAcceso>
  )
}
