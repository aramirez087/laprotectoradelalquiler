import { redirect } from 'next/navigation'
import { MarcoAcceso } from '@/components/marco-acceso'
import { BotonSalir } from '@/components/boton-salir'
import { VerificarDosFactores } from '@/components/verificar-dos-factores'
import { cerrarSesion } from '@/lib/actions/auth'
import { createClient, sinSupabase } from '@/lib/supabase/server'
import { requiereSegundoFactor, destinoSegundoFactor } from '@/lib/dos-factores'
import { primer } from '@/lib/util'

export const metadata = { title: 'Verificación en dos pasos', robots: { index: false, follow: false } }

export default async function VerificarPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  const siguiente = destinoSegundoFactor(primer(params.siguiente))
  if (sinSupabase()) redirect('/login')
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect(`/login?${new URLSearchParams({ siguiente })}`)
  if (!await requiereSegundoFactor(supabase, user)) redirect(siguiente)
  const factores = (user.factors ?? []).filter(f => f.factor_type === 'totp' && f.status === 'verified')
    .map((f, i) => ({ id: f.id, nombre: f.friendly_name || `Autenticador ${i + 1}` }))

  return <MarcoAcceso titulo="Verificación en dos pasos" texto="Abra su aplicación autenticadora y escriba el código para completar el ingreso.">
    <div className="space-y-5">
      {factores.length ? <VerificarDosFactores factores={factores} siguiente={siguiente} />
        : <p role="alert" className="aviso aviso-error">No encontramos una aplicación autenticadora disponible para esta cuenta.</p>}
      <details className="text-sm">
        <summary className="min-h-11 content-center cursor-pointer font-medium text-seal">No tengo acceso a mi aplicación</summary>
        <p className="mt-2 leading-relaxed text-ink-soft">Restaure la copia de respaldo de su aplicación o use la clave de configuración que guardó al activar la verificación. Recuperar la clave de la cuenta no desactiva esta protección.</p>
      </details>
      <form action={cerrarSesion}><BotonSalir className="btn-secundario w-full">Cerrar sesión y volver</BotonSalir></form>
    </div>
  </MarcoAcceso>
}
