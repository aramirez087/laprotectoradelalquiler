import { FormClave } from '@/components/form-clave'
import { CabeceraAdmin } from '@/components/admin-ui'

export const metadata = { title: 'Configuración' }

export default function ConfiguracionPage() {
  return (
    <div className="contenedor max-w-3xl space-y-7">
      <CabeceraAdmin titulo="Configuración" descripcion="Gestione la seguridad de su cuenta de administración." />
      <section className="expediente space-y-5" aria-labelledby="cambiar-clave">
        <div><h2 id="cambiar-clave" className="text-xl">Cambiar mi clave</h2><p className="mt-2 text-sm leading-6 text-ink-soft">Este cambio se aplica a la cuenta con la que inició sesión.</p></div>
        <FormClave />
      </section>
    </div>
  )
}
