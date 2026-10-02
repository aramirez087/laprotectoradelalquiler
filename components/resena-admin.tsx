import { correoResenasConfigurado } from '@/lib/correo-resenas'
import Link from '@/components/enlace'
import { FormDecision, FormEditarResena, FormEliminarResena } from '@/components/admin-formularios'
import { CedulaAdmin } from '@/components/cedula-admin'
import { PerfilFacebook } from '@/components/perfil-facebook'
import { HistorialResena } from '@/components/historial-resena'
import type { FilaAdminResena, ModeracionAutomaticaResena } from '@/lib/admin'
import { etiquetaEstado, fechaCorta, nombreCompleto } from '@/lib/util'
import type { EstadoResena } from '@/lib/tipos'

function decisionesDe(estado: EstadoResena): Array<'publicar' | 'corregir' | 'rechazar' | 'revisar'> {
  if (estado === 'borrador') return ['publicar', 'corregir', 'rechazar']
  if (estado === 'oculta') return ['publicar', 'corregir', 'rechazar', 'revisar']
  return ['rechazar']
}

const motivosAutomaticos: Record<string, string> = {
  contenido_seguro: 'Ambas cédulas verificadas y contenido apto para publicación.',
  contenido_sensible: 'Se detectó contenido sensible que requiere revisión humana.',
  contenido_incierto: 'No se pudo confirmar que el contenido sea apto para publicación.',
  moderacion_no_configurada: 'La evaluación automática no está configurada.',
  moderacion_no_disponible: 'El servicio de evaluación automática no estuvo disponible.',
  moderacion_limite: 'La evaluación automática alcanzó su límite; revise la reseña manualmente.',
  respuesta_invalida: 'El servicio no devolvió una evaluación válida.',
  resultado_invalido: 'La evaluación no cumple los requisitos para publicarse automáticamente.',
  contenido_invalido: 'El relato no cumple los requisitos de contenido.',
  cedula_autor_no_verificada: 'No se pudo verificar la cédula del autor en el TSE.',
  cedula_inquilino_no_verificada: 'No se pudo verificar la cédula del inquilino en el TSE.',
  nombre_inquilino_no_coincide: 'El nombre del inquilino no coincide con el padrón del TSE.',
  resena_obsoleta: 'La reseña cambió durante la evaluación; este resultado no se aplicó.',
  autor_inactivo: 'La cuenta del autor estaba inactiva al aplicar la evaluación.',
  identidad_cambio: 'Los datos de identidad cambiaron durante la evaluación.',
  cedula_no_verificada: 'No se pudo confirmar la validación de ambas cédulas.',
  padron_desactualizado: 'La validación usa un padrón que necesita actualizarse.',
  padron_cambio: 'El padrón cambió durante la evaluación; vuelva a comprobar ambas cédulas.',
}

const categoriasAutomaticas: Record<string, string> = {
  sexual_explicito: 'Contenido sexual explícito',
  sexual_menores: 'Contenido sexual con menores',
  violencia_grafica: 'Violencia gráfica',
  odio_o_amenazas: 'Odio o amenazas',
  datos_personales: 'Datos personales',
  instrucciones: 'Instrucciones dirigidas al evaluador',
  fuera_de_contexto: 'Contenido ajeno a la experiencia de alquiler',
  incierto: 'Contenido incierto',
}

function EvaluacionAutomatica({ resultado, version }: { resultado: ModeracionAutomaticaResena; version: number }) {
  const actual = resultado.decision !== 'obsoleta' && version === (resultado.version_resultante ?? resultado.version_evaluada)
  const decision = resultado.decision === 'aprobada' ? 'Aprobación automática'
    : resultado.decision === 'obsoleta' ? 'Evaluación no aplicada' : 'Derivada a revisión humana'
  return (
    <div className="rounded-lg border border-line bg-paper p-4 text-sm">
      <p className="etiqueta-campo">Última evaluación automática</p>
      <p className="mt-2 font-medium">{decision}</p>
      <p className="mt-1 leading-6 text-ink-soft">{Object.hasOwn(motivosAutomaticos, resultado.motivo) ? motivosAutomaticos[resultado.motivo] : 'Requiere revisión humana.'}</p>
      {resultado.categorias.length > 0 && <p className="mt-2 leading-6 text-ink-soft">Indicadores: {resultado.categorias.map(categoria => Object.hasOwn(categoriasAutomaticas, categoria) ? categoriasAutomaticas[categoria] : 'Contenido por revisar').join(', ')}.</p>}
      {!actual && <p className="mt-2 text-alerta">Corresponde a una versión anterior. Revise el relato actual antes de decidir.</p>}
      <details className="mt-3">
        <summary className="min-h-11 content-center cursor-pointer text-xs font-medium text-seal">Detalles de la evaluación</summary>
        <dl className="mt-2 grid gap-3 text-xs text-ink-soft sm:grid-cols-2">
          <div><dt>Evaluada</dt><dd className="mt-1">{fechaCorta(resultado.evaluada_en)}</dd></div>
          <div><dt>Versión del relato</dt><dd className="mt-1">{resultado.version_evaluada}</dd></div>
          {resultado.modelo && <div><dt>Modelo</dt><dd className="mt-1 break-words">{resultado.modelo}</dd></div>}
          <div><dt>Política</dt><dd className="mt-1 break-words">{resultado.politica}</dd></div>
        </dl>
      </details>
    </div>
  )
}

export function ResenaAdmin({ fila, nivelTitulo = 2 }: { fila: FilaAdminResena; nivelTitulo?: 2 | 3 }) {
  const nombre = nombreCompleto(fila.persona)
  const Titulo = nivelTitulo === 3 ? 'h3' : 'h2'
  const notificacionesHabilitadas = correoResenasConfigurado()

  return (
    <article className="expediente space-y-5" aria-labelledby={`resena-${fila.id}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-2">Reseña #{fila.id} · {fechaCorta(fila.creado_en)}</p>
          <Titulo id={`resena-${fila.id}`} className="text-xl"><Link href={`/fichas/${fila.persona.id}`} className="break-words text-seal underline-offset-4 hover:underline">{nombre}</Link></Titulo>
          <p className="mt-1 break-words text-sm text-ink-soft">Cédula del inquilino: {fila.persona.identificacion}</p>
          <CedulaAdmin identificacion={fila.persona.identificacion} nombre={nombre} verificacion={fila.persona.verificacionCedula} />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:max-w-56 sm:flex-col sm:items-end">
          <span className={fila.estado === 'publicada' ? 'chip chip-ok' : fila.estado === 'oculta' ? 'chip chip-alerta' : 'chip'}>{fila.permite_correccion ? 'Corrección solicitada' : etiquetaEstado(fila.estado)}</span>
        </div>
      </div>
      <dl className="grid gap-4 rounded-lg bg-paper p-4 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-xs text-ink-soft">Escrita por</dt><dd className="mt-1 break-words font-medium">{fila.autor?.nombre ?? 'Sin autor registrado'}</dd>
          {fila.autor?.identificacion && <dd className="mt-1 break-words text-xs text-ink-soft">Cédula: {fila.autor.identificacion}</dd>}
          {fila.autor && <dd>
            <CedulaAdmin identificacion={fila.autor.identificacion} nombre={fila.autor.nombre} verificacion={fila.autor.verificacionCedula} />
          </dd>}
          {fila.autor?.facebook && <dd className="mt-1"><PerfilFacebook valor={fila.autor.facebook} className="text-seal underline underline-offset-2" /></dd>}
        </div>
        <div><dt className="text-xs text-ink-soft">Nombre del autor en la ficha</dt><dd className="mt-1">{fila.anonima ? 'Anónimo' : 'Visible'}</dd></div>
      </dl>
      <div><p className="eyebrow mb-2">Experiencia compartida</p><p className="break-words whitespace-pre-wrap text-sm leading-7">{fila.comentario?.trim() || 'Sin comentario.'}</p></div>
      {fila.moderacionAutomatica && <EvaluacionAutomatica resultado={fila.moderacionAutomatica} version={fila.version} />}
      {fila.detalle_verificacion && <div className="border-l-2 border-line pl-4"><p className="etiqueta-campo">Última nota de moderación</p><p className="break-words whitespace-pre-wrap text-sm leading-6 text-ink-soft">{fila.detalle_verificacion}</p></div>}
      <HistorialResena versiones={fila.historial ?? []} />
      <div className="border-t border-line pt-5"><FormDecision key={`${fila.id}-${fila.version}`} id={fila.id} version={fila.version} nota={fila.detalle_verificacion} decisiones={decisionesDe(fila.estado)} notificacionesHabilitadas={notificacionesHabilitadas} /></div>
      <div className="space-y-2 border-t border-line pt-4">
        <FormEditarResena
          key={`${fila.id}-${fila.version}`}
          id={fila.id}
          version={fila.version}
          persona={fila.persona}
          comentario={fila.comentario}
          anonima={fila.anonima}
          notificacionesHabilitadas={notificacionesHabilitadas}
        />
        <FormEliminarResena id={fila.id} notificacionesHabilitadas={notificacionesHabilitadas} />
      </div>
    </article>
  )
}
