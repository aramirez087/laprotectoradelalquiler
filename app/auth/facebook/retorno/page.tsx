import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { RetornoFacebook } from '@/components/retorno-facebook'
import { authFacebookHabilitado, rutaTrasFalloFacebook } from '@/lib/facebook-auth'
import { primer } from '@/lib/util'
import { MarcoAcceso } from '@/components/marco-acceso'

export async function generateMetadata(): Promise<Metadata> {
  if (!authFacebookHabilitado()) return {}
  return { title: 'Un momento' }
}

export default async function RetornoFacebookPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!authFacebookHabilitado()) redirect('/login')

  const params = await props.searchParams
  const siguiente = primer(params.next) || '/fichas'
  const modo = primer(params.modo) === 'vincular' ? 'vincular' : 'entrar'
  const descripcion = primer(params.error_description) || primer(params.error)
  if (descripcion) redirect(rutaTrasFalloFacebook(descripcion, modo, siguiente))

  const code = primer(params.code)
  if (code) {
    const confirmar = new URLSearchParams({ code, origen: 'facebook', next: modo === 'vincular' ? '/perfil' : siguiente })
    if (modo === 'vincular') confirmar.set('modo', 'vincular')
    const flowId = primer(params.sb_flow_id)
    if (flowId) confirmar.set('sb_flow_id', flowId)
    redirect(`/auth/confirmar?${confirmar}`)
  }

  return (
    <MarcoAcceso titulo="Estamos completando su acceso" texto="En un momento le llevaremos al siguiente paso.">
      <RetornoFacebook />
      <p role="status" className="aviso aviso-ok">Comprobando la respuesta de Facebook…</p>
      <p className="mt-5 text-sm text-ink-soft">Si esta página no avanza, puede volver e intentar de nuevo.</p>
      <Link href={modo === 'vincular' ? '/perfil' : `/login?${new URLSearchParams({ siguiente })}`} className="btn-secundario mt-4 w-full">
        {modo === 'vincular' ? 'Volver a mi perfil' : 'Volver a iniciar sesión'}
      </Link>
    </MarcoAcceso>
  )
}
