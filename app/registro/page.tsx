import { RegistroForm } from '@/components/registro-form'
import { AvisoConfiguracion } from '@/components/aviso-configuracion'
import { sinSupabase } from '@/lib/supabase/server'

export const metadata = { title: 'Crear cuenta' }

export default function RegistroPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-2 text-2xl">Crear cuenta</h1>
      <p className="mb-6 text-sm text-ink-soft">
        Para consultar fichas, administración tiene que aprobar una reseña suya.
      </p>
      {sinSupabase() ? <AvisoConfiguracion /> : <RegistroForm />}
    </div>
  )
}
