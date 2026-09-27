import { FormClave } from '@/components/form-clave'

export const metadata = { title: 'Configuración' }

export default function ConfiguracionPage() {
  return (
    <div className="contenedor space-y-6">
      <h1 className="text-3xl">Configuración</h1>
      <section className="space-y-3">
        <h2 className="text-2xl">Clave</h2>
        <FormClave />
      </section>
    </div>
  )
}
