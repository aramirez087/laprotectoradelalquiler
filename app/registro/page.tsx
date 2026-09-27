import { RegistroForm } from '@/components/registro-form'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'

export const metadata = { title: 'Crear cuenta' }

export default function RegistroPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-6 text-2xl">Crear cuenta</h1>
      {sinSupabase() ? <AvisoConfiguracion /> : <RegistroForm />}
    </div>
  )
}
