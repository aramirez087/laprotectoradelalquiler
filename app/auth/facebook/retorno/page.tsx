import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RetornoFacebook } from '@/components/retorno-facebook'
import { authFacebookHabilitado, rutaTrasFalloFacebook } from '@/lib/facebook-auth'
import { primer } from '@/lib/util'

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
    <div className="contenedor py-16">
      <RetornoFacebook />
      <p className="text-sm text-ink-soft">Un momento…</p>
    </div>
  )
}
