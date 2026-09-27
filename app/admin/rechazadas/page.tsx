import { consultarResenas, SinClaveAdmin, TAMANO_PAGINA_ADMIN } from '@/lib/admin'
import { Paginacion } from '@/components/paginacion'
import { ResenaAdmin } from '@/components/resena-admin'
import { paginaSegura, primer } from '@/lib/util'

export const metadata = { title: 'Rechazados' }

export default async function RechazadasPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const pagina = paginaSegura(primer((await props.searchParams).pagina))
  let filas: Awaited<ReturnType<typeof consultarResenas>>['filas'] = []
  let total = 0
  let aviso: string | null = null

  try {
    const resultado = await consultarResenas({ estado: 'oculta', pagina })
    filas = resultado.filas
    total = resultado.total
  } catch (e) {
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar las reseñas rechazadas.'
  }

  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))

  return (
    <div className="contenedor space-y-5">
      <h1 className="text-3xl">Rechazados</h1>
      {aviso && <p className="aviso aviso-error">{aviso}</p>}
      {!aviso && filas.length === 0 && <p className="text-sm text-ink-soft">No hay reseñas rechazadas.</p>}
      <div className="space-y-3">
        {filas.map((fila) => (
          <ResenaAdmin key={fila.id} fila={fila} />
        ))}
      </div>
      <Paginacion
        pagina={pagina}
        paginas={paginas}
        href={(n) => (n > 1 ? `/admin/rechazadas?pagina=${n}` : '/admin/rechazadas')}
      />
    </div>
  )
}
