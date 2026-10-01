import type { ResumenActivacion, ResumenAvisos } from '@/lib/activacion'
import { formatoNumero } from '@/lib/util'
import { ReintentarAvisos } from '@/components/avisos-moderacion'

export function ActivacionAdmin({ resumen }: { resumen: { datos: ResumenActivacion; avisos: ResumenAvisos } | null }) {
  if (!resumen) return <section className="expediente space-y-3"><h2 className="text-xl">De la cuenta a la primera consulta</h2>
    <p role="alert" className="text-sm text-ink-soft">No pudimos consultar la activación. Revise la migración y vuelva a cargar esta página. No se muestran ceros para datos no disponibles.</p></section>
  const { datos, avisos } = resumen
  const pasos = [['Cuentas creadas', datos.cuentas], ['Primera reseña enviada', datos.enviaron],
    ['Primera aprobación', datos.aprobadas], ['Primera búsqueda completada', datos.consultaron]] as const
  const fecha = (valor: string) => new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeZone: 'America/Costa_Rica' }).format(new Date(valor))
  const desplazar = (valor: string, dias: number) => new Date(new Date(valor).getTime() + dias*86_400_000).toISOString()
  return <section className="space-y-5" aria-labelledby="titulo-activacion">
    <div><h2 id="titulo-activacion" className="text-2xl">De la cuenta a la primera consulta</h2>
      <p className="mt-2 text-sm text-ink-soft">La misma cohorte de cuentas nuevas del período seleccionado, con sus avances hasta ahora. Cada cuenta aparece una vez por paso.</p>
      <p className="mt-1 text-xs text-ink-soft">Medición desde el {fecha(datos.iniciada_en)}. Días completos de Costa Rica; las cuentas anteriores y las de administración quedan fuera.</p></div>
    <p className="text-xs text-ink-soft">Cuentas creadas del {fecha(datos.desde)} al {fecha(desplazar(datos.hasta,-1))}.</p>
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{pasos.map(([nombre, cantidad]) => <li key={nombre} className="metrico">
      <p className="text-sm text-ink-soft">{nombre}</p><p className="mt-4 text-4xl font-medium tabular-nums">{formatoNumero(cantidad)}</p>
      <p className="mt-3 text-xs text-ink-soft">{datos.cuentas ? `${Math.round(cantidad / datos.cuentas * 100)}% de la cohorte` : 'Todavía no hay cuentas nuevas en esta cohorte.'}</p>
    </li>)}</ol>
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="expediente"><h3 className="text-lg">Primera búsqueda en 7 días</h3>
        <p className="mt-4 text-3xl tabular-nums">{datos.maduras ? `${Math.round(datos.activadas_7d / datos.maduras * 100)}%` : '—'}</p>
        <p className="mt-3 text-sm text-ink-soft">{datos.maduras ? `${datos.activadas_7d} de ${datos.maduras} cuentas.` : 'Aún no hay cuentas con siete días completos de observación.'} Cuentas creadas del {fecha(desplazar(datos.desde,-7))} al {fecha(desplazar(datos.hasta,-8))}, con siete días completos para realizar su primera búsqueda.</p></div>
      <div className="expediente"><h3 className="text-lg">Tiempo hasta la primera aprobación</h3>
        <p className="mt-4 text-3xl tabular-nums">{datos.mediana_horas === null ? '—' : `${new Intl.NumberFormat('es-CR', { maximumFractionDigits: 1 }).format(datos.mediana_horas)} h`}</p>
        <p className="mt-3 text-sm text-ink-soft">Mediana de {formatoNumero(datos.revisiones)} reseñas medidas cuya primera aprobación ocurrió en el período. Incluye el tiempo de correcciones.</p></div>
    </div>
    <div className="expediente"><h3 className="text-lg">Avisos de moderación</h3>
      <p className="mt-2 text-sm text-ink-soft">Pendientes: {formatoNumero(avisos.pendientes)} · Por revisar: {formatoNumero(avisos.revision)}.</p>
      {avisos.revision > 0 && <p role="alert" className="aviso aviso-atencion mt-3">Hay envíos sin confirmar o rechazados por el servicio. Revise los registros del proveedor antes de reenviar; repetir una decisión de moderación puede generar otro aviso.</p>}
      {avisos.detalle_revision.length > 0 && <ul className="mt-4 space-y-3" aria-label="Avisos que necesitan revisión">
        {avisos.detalle_revision.map(aviso => <li key={aviso.id} className="rounded-lg border border-line p-3 text-sm">
          <p>Reseña #{aviso.resena_id} · {aviso.accion === 'aprobada' ? 'Aprobación' : aviso.accion === 'corregir' ? 'Corrección' : 'Rechazo'} · {fecha(aviso.creado_en)} · Intentos: {aviso.intentos}</p>
          <p className="mt-1 text-xs text-ink-soft">Referencia para soporte: <code className="break-all">moderacion/{aviso.id}</code></p>
          {aviso.proveedor_id && <p className="mt-1 break-all text-xs text-ink-soft">Referencia del servicio: {aviso.proveedor_id}</p>}
        </li>)}
      </ul>}
      {avisos.revision > avisos.detalle_revision.length && <p className="mt-2 text-xs text-ink-soft">Se muestran los 10 avisos más antiguos que necesitan revisión.</p>}
      <ReintentarAvisos />
      <p className="mt-3 text-xs text-ink-soft">«Aceptado» confirma la recepción por el servicio de correo, no la entrega en la bandeja del autor.</p></div>
  </section>
}
