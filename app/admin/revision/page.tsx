import Link from 'next/link'
import { consultarResenas, listarDenunciasPendientes, SinClaveAdmin, TAMANO_PAGINA_ADMIN } from '@/lib/admin'
import { FormDenunciaAdmin } from '@/components/admin-formularios'
import { Paginacion } from '@/components/paginacion'
import { ResenaAdmin } from '@/components/resena-admin'
import { etiquetaMotivo, fechaCorta, paginaSegura, primer } from '@/lib/util'

export const metadata = { title: 'Revisión' }

export default async function RevisionPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const pagina = paginaSegura(primer((await props.searchParams).pagina))
  let filas: Awaited<ReturnType<typeof consultarResenas>>['filas'] = []
  let denuncias: Awaited<ReturnType<typeof listarDenunciasPendientes>> = []
  let total = 0
  let aviso: string | null = null

  try {
    const [reseñas, cola] = await Promise.all([
      consultarResenas({ estado: 'borrador', pagina }),
      listarDenunciasPendientes(),
    ])
    filas = reseñas.filas
    total = reseñas.total
    denuncias = cola
  } catch (e) {
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar la revisión.'
  }

  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))

  return (
    <div className="contenedor space-y-8">
      <section className="space-y-4">
        <h1 className="text-3xl">Revisión</h1>
        {aviso && <p className="aviso aviso-error">{aviso}</p>}
        {!aviso && filas.length === 0 && <p className="text-sm text-ink-soft">No hay reseñas en revisión.</p>}
        <div className="space-y-3">
          {filas.map((fila) => (
            <ResenaAdmin key={fila.id} fila={fila} />
          ))}
        </div>
        <Paginacion
          pagina={pagina}
          paginas={paginas}
          href={(n) => (n > 1 ? `/admin/revision?pagina=${n}` : '/admin/revision')}
        />
      </section>

      <section id="denuncias" className="space-y-4">
        <h2 className="text-2xl">Denuncias</h2>
        {!aviso && denuncias.length === 0 && <p className="text-sm text-ink-soft">No hay denuncias pendientes.</p>}
        <div className="space-y-3">
          {denuncias.map((denuncia) => (
            <article key={denuncia.id} className="expediente space-y-3">
              <div>
                <p className="text-sm text-ink-soft">
                  {etiquetaMotivo(denuncia.motivo)} · {denuncia.denunciante} · {fechaCorta(denuncia.creado_en)}
                </p>
                {denuncia.personaId ? (
                  <Link href={`/fichas/${denuncia.personaId}`} className="text-xl">
                    {denuncia.persona}
                  </Link>
                ) : (
                  <p className="text-xl">{denuncia.persona}</p>
                )}
              </div>
              {denuncia.detalle && <p className="text-sm">{denuncia.detalle}</p>}
              {denuncia.comentario && <p className="text-sm text-ink-soft">{denuncia.comentario}</p>}
              <FormDenunciaAdmin id={denuncia.id} />
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
