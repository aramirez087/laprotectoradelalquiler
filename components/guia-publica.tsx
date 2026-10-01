import type { ReactNode } from 'react'
import Link from '@/components/enlace'
import { JsonLd } from '@/components/json-ld'
import { GUIAS_PUBLICAS, type InfoGuia } from '@/lib/guias'
import { datosPagina } from '@/lib/seo'

export function GuiaPublica({ guia, children }: { guia: InfoGuia; children: ReactNode }) {
  return (
    <article className="contenedor max-w-3xl space-y-10 py-10 sm:space-y-12">
      <JsonLd datos={datosPagina(guia.ruta, guia.titulo, guia.descripcion)} />
      <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
        <Link href="/" className="enlace-atras">Inicio</Link>
        <span aria-hidden="true">/</span>
        <Link href="/guias" className="enlace-atras">Guías</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{guia.nombre}</span>
      </nav>

      <header className="space-y-4">
        <p className="eyebrow">Guías para propietarios y agencias · Costa Rica</p>
        <h1 className="text-3xl sm:text-4xl">{guia.titulo}</h1>
        <p className="text-base leading-relaxed text-ink-soft">{guia.resumen}</p>
        <p className="text-sm text-seal">{guia.recurso} · Lectura sin registro</p>
      </header>

      <nav aria-label="En esta guía" className="rounded-2xl border border-line bg-card p-5">
        <p className="mb-2 text-sm font-semibold">En esta guía</p>
        <ul className="grid gap-x-5 sm:grid-cols-2">
          {guia.secciones.map(({ id, nombre }) => (
            <li key={id}><a href={`#${id}`} className="enlace-texto">{nombre}</a></li>
          ))}
        </ul>
      </nav>

      <div className="space-y-10 text-base leading-relaxed [&_h2]:text-2xl [&_h2]:sm:text-3xl [&_h3]:text-lg [&_h3]:font-semibold [&_p]:text-ink-soft [&_li]:text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink">
        {children}
      </div>

      <section aria-labelledby="guias-relacionadas" className="space-y-4 border-t border-line pt-8">
        <h2 id="guias-relacionadas" className="text-2xl">Siga con estas guías</h2>
        <ul className="space-y-4">
          {GUIAS_PUBLICAS.filter(otra => otra.ruta !== guia.ruta).map(otra => (
            <li key={otra.ruta}>
              <Link href={otra.ruta} className="enlace-texto">{otra.titulo} →</Link>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{otra.recurso}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-card p-5 sm:p-6">
        <h2 className="text-2xl">Conozca cómo se consultan las reseñas</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          La Protectora reúne experiencias de propietarios y agencias en Costa Rica. Puede explorar
          una ficha ficticia sin registrarse. Para consultar fichas reales necesita una cuenta y permiso
          vigente; su primera reseña aprobada activa 3 meses de consultas gratis.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/ejemplo" className="btn-secundario">Ver una consulta de ejemplo</Link>
          <Link href="/registro" className="btn-primario" data-evento-publico={guia.eventoRegistro}>Compartir mi experiencia</Link>
        </div>
        <Link href="/como-funciona" className="enlace-texto text-sm">Conocer los pasos y las reglas de acceso →</Link>
      </section>
    </article>
  )
}
