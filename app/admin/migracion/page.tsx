import { FormMigracionLegacy } from '@/components/form-migracion-legacy'
import { configuracionDestinoLegacy } from '@/lib/migracion-legacy'

export const metadata = { title: 'Importar sistema anterior' }
export const runtime = 'nodejs'
export const maxDuration = 300

export default function MigracionLegacyPage() {
  const destino = configuracionDestinoLegacy()

  return (
    <div className="contenedor space-y-7">
      <header className="max-w-3xl">
        <p className="eyebrow mb-3">Administración · Migración</p>
        <h1 className="text-3xl sm:text-4xl">Traer datos del sistema anterior</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          Conecte la base MySQL anterior y copie catálogos, personas, usuarios y reseñas al registro actual.
          La importación puede tardar algunos minutos.
        </p>
      </header>

      {!destino.baseDatos && (
        <p className="aviso aviso-error" role="alert">
          El destino no está listo: falta la conexión de Postgres en el servidor. Todavía puede probar la conexión al origen.
        </p>
      )}

      <FormMigracionLegacy authDisponible={destino.auth} destinoDisponible={destino.baseDatos} />
    </div>
  )
}
