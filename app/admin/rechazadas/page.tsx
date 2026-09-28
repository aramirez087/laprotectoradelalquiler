import { redirect } from 'next/navigation'
import { CabeceraAdmin, ResultadosAdmin, VacioAdmin } from '@/components/admin-ui'
import { consultarResenas, SinClaveAdmin, TAMANO_PAGINA_ADMIN } from '@/lib/admin'
import { Paginacion } from '@/components/paginacion'
import { ResenaAdmin } from '@/components/resena-admin'
import { paginaSegura, primer } from '@/lib/util'

export const metadata = { title: 'Reseñas rechazadas' }

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
  if (!aviso && pagina > paginas) redirect(paginas > 1 ? `/admin/rechazadas?pagina=${paginas}` : '/admin/rechazadas')

  return (
    <div className="contenedor space-y-7">
      <CabeceraAdmin titulo="Reseñas rechazadas" descripcion="Consulte las decisiones anteriores. Si corresponde, puede publicar una reseña o devolverla a revisión." />
      {aviso && <p className="aviso aviso-error" role="alert">{aviso}</p>}
      {!aviso && <ResultadosAdmin pagina={pagina} tamano={TAMANO_PAGINA_ADMIN} total={total} />}
      {!aviso && filas.length === 0 && <VacioAdmin titulo="No hay reseñas rechazadas" descripcion="Cuando una reseña se rechace, podrá consultar aquí su contenido y el motivo de la decisión." href="/admin/revision" accion="Ir a revisión" />}
      <div className="space-y-5">
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
