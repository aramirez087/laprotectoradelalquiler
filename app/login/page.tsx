import { LoginForm } from '@/components/login-form'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'
import { destinoInterno } from '@/lib/util'

export const metadata = { title: 'Entrar' }

function primer(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const siguiente = destinoInterno(primer(searchParams.siguiente))

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl">Entrar</h1>
      {sinSupabase() ? <AvisoConfiguracion /> : <LoginForm siguiente={siguiente} />}
    </div>
  )
}
