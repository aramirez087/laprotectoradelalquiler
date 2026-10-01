import Link from '@/components/enlace'
import { JsonLd } from '@/components/json-ld'
import { GUIAS_PUBLICAS } from '@/lib/guias'
import { datosPagina, metadataPublica } from '@/lib/seo'

const descripcion = 'Guías para propietarios en Costa Rica: cómo pedir referencias de inquilinos, qué preguntar y cómo escribir una reseña. Plantillas y listas sin registro.'

export const metadata = metadataPublica({
  titulo: 'Guías sobre referencias de inquilinos | La Protectora',
  descripcion,
  ruta: '/guias',
})

export default function GuiasPage() {
  return (
    <article className="contenedor max-w-4xl space-y-10 py-10 sm:space-y-12">
      <JsonLd datos={datosPagina('/guias', 'Guías para propietarios', descripcion)} />
      <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
        <Link href="/" className="enlace-atras">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Guías</span>
      </nav>

      <header className="max-w-3xl space-y-4">
        <p className="eyebrow">Propietarios y agencias · Costa Rica</p>
        <h1 className="text-3xl sm:text-4xl">Guías para pedir referencias y compartir experiencias de alquiler</h1>
        <p className="text-base leading-relaxed text-ink-soft">
          Prepare una conversación con un arrendador anterior, ordene sus respuestas o escriba
          una reseña que ayude a otros propietarios. Estas guías incluyen ejemplos, plantillas y
          listas que puede usar sin crear una cuenta.
        </p>
      </header>

      <section aria-labelledby="elegir-guia" className="space-y-6">
        <h2 id="elegir-guia" className="text-2xl">Elija el paso que necesita</h2>
        <ol className="divide-y divide-line border-y border-line">
          {GUIAS_PUBLICAS.map((guia, indice) => (
            <li key={guia.ruta} className="flex gap-4 py-7 sm:gap-6">
              <span aria-hidden="true" className="numero-paso shrink-0">{indice + 1}</span>
              <div className="min-w-0 space-y-3">
                <h3 className="text-xl font-medium sm:text-2xl">
                  <Link href={guia.ruta} className="text-seal underline decoration-seal/30 underline-offset-4 hover:decoration-seal">{guia.titulo}</Link>
                </h3>
                <p className="text-base leading-relaxed text-ink-soft">{guia.resumen}</p>
                <p className="text-sm text-ink-soft">Incluye: {guia.recurso.toLowerCase()}.</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="max-w-3xl space-y-4">
        <h2 className="text-2xl">Una referencia aporta contexto</h2>
        <p className="text-base leading-relaxed text-ink-soft">
          Un relato describe una experiencia de alquiler. Considere cuándo ocurrió, quién la cuenta,
          qué hechos describe y qué queda por aclarar. La falta de referencias no demuestra una mala
          experiencia, y una referencia favorable no garantiza el resultado de un alquiler nuevo.
        </p>
        <p className="text-base leading-relaxed text-ink-soft">
          Si desea conocer las reseñas de La Protectora, empiece por la consulta de ejemplo. Las fichas
          reales y las identidades de inquilinos requieren una cuenta y permiso de consulta vigente.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/ejemplo" className="btn-secundario">Ver una consulta de ejemplo</Link>
          <Link href="/como-funciona" className="enlace-texto">Cómo funciona La Protectora →</Link>
        </div>
      </section>
    </article>
  )
}
