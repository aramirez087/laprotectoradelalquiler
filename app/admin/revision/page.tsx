import { registrarError } from '@/lib/registro-error'
import { redirect } from 'next/navigation'
import { CabeceraAdmin, ResultadosAdmin, VacioAdmin } from '@/components/admin-ui'
import Link from '@/components/enlace'
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
    registrarError('page_load_error', e, { route: '/admin/revision', routeType: 'render' })
    aviso = e instanceof SinClaveAdmin ? e.message : 'No pudimos cargar la revisión.'
  }

  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_ADMIN))
  if (!aviso && pagina > paginas) redirect(paginas > 1 ? `/admin/revision?pagina=${paginas}` : '/admin/revision')

  return (
    <div className="contenedor space-y-8">
      <CabeceraAdmin titulo="Revisión" descripcion="Revise la identidad y el relato de cada experiencia antes de decidir. Las reseñas y denuncias pendientes están reunidas aquí." accion={<a href="#denuncias" className="btn-secundario">Ver denuncias{!aviso ? ` (${denuncias.length})` : ''}</a>} />
      <section className="space-y-5" aria-labelledby="resenas-pendientes">
        <div>
          <h2 id="resenas-pendientes" className="text-xl">Reseñas pendientes</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">Aquí aparecen las reseñas que requieren revisión humana. Consulte el resultado de la evaluación automática cuando esté disponible y compruebe ambas cédulas, el perfil de Facebook y el relato antes de decidir. Cada primera aprobación suma 3 meses al permiso vigente, hasta acumular 12 meses.</p>
        </div>
        {aviso && <p className="aviso aviso-error" role="alert">{aviso}</p>}
        {!aviso && <ResultadosAdmin pagina={pagina} tamano={TAMANO_PAGINA_ADMIN} total={total} />}
        {!aviso && filas.length === 0 && <VacioAdmin titulo="La revisión está al día" descripcion="No hay reseñas pendientes. Las nuevas contribuciones que necesiten aprobación aparecerán aquí." />}
        <div className="space-y-5">
          {filas.map((fila) => (
            <ResenaAdmin key={fila.id} fila={fila} nivelTitulo={3} />
          ))}
        </div>
        <Paginacion
          pagina={pagina}
          paginas={paginas}
          href={(n) => (n > 1 ? `/admin/revision?pagina=${n}` : '/admin/revision')}
        />
      </section>

      <section id="denuncias" className="space-y-5 border-t border-line pt-8" aria-labelledby="denuncias-titulo">
        <div><h2 id="denuncias-titulo" className="text-2xl">Denuncias pendientes</h2><p className="mt-2 text-sm text-ink-soft">Lea el motivo y la reseña antes de resolver cada denuncia.</p></div>
        {!aviso && denuncias.length === 0 && <VacioAdmin titulo="No hay denuncias pendientes" descripcion="Las solicitudes de revisión de la comunidad aparecerán aquí." />}
        <div className="space-y-3">
          {denuncias.map((denuncia) => (
            <article key={denuncia.id} className="expediente space-y-3">
              <div>
                <p className="text-sm text-ink-soft">
                  {etiquetaMotivo(denuncia.motivo)} · {denuncia.denunciante} · {fechaCorta(denuncia.creado_en)}
                </p>
                {denuncia.personaId ? (
                  <Link href={`/fichas/${denuncia.personaId}`} className="text-xl font-medium text-seal underline-offset-4 hover:underline">
                    {denuncia.persona}
                  </Link>
                ) : (
                  <p className="text-xl">{denuncia.persona}</p>
                )}
              </div>
              {denuncia.detalle && <div><p className="etiqueta-campo">Motivo de la denuncia</p><p className="whitespace-pre-wrap text-sm leading-6">{denuncia.detalle}</p></div>}
              {denuncia.comentario && <div className="rounded-lg bg-paper p-4"><p className="eyebrow mb-2">Reseña denunciada</p><p className="whitespace-pre-wrap text-sm leading-6">{denuncia.comentario}</p></div>}
              <FormDenunciaAdmin id={denuncia.id} />
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
