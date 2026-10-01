import type { Metadata } from 'next'

// Keep every canonical URL on the established production domain, including previews.
export const ORIGEN_SITIO = 'https://www.protectoradelalquiler.com'
export const NOMBRE_SITIO = 'La Protectora del Alquiler'
export const DESCRIPCION_SITIO =
  'Consulte reseñas de inquilinos en Costa Rica y comparta su experiencia como propietario o agencia. Su primera reseña aprobada le da 3 meses de consultas gratis.'

// Only public informational pages belong in the sitemap. Never add tenant records.
export const RUTAS_PUBLICAS = [
  '/', '/como-funciona', '/privacidad', '/guias',
  '/guias/referencias-de-inquilinos',
  '/guias/preguntas-para-arrendadores',
  '/guias/como-escribir-una-resena',
] as const
export type RutaPublica = (typeof RUTAS_PUBLICAS)[number]

export function esEntornoIndexable() {
  return !['preview', 'development'].includes(process.env.VERCEL_ENV ?? '')
}

export function urlPublica(ruta: string) {
  return new URL(ruta, ORIGEN_SITIO).toString()
}

export const ROBOTS_PRIVADOS: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
    nosnippet: true,
  },
}

const imagenCompartida = {
  url: urlPublica('/opengraph-image'),
  width: 1200,
  height: 630,
  alt: 'La Protectora del Alquiler: reseñas de inquilinos en Costa Rica',
}

export function metadataPublica({
  titulo,
  descripcion,
  ruta,
}: {
  titulo: string
  descripcion: string
  ruta: RutaPublica | '/ejemplo'
}): Metadata {
  return {
    title: { absolute: titulo },
    description: descripcion,
    alternates: { canonical: urlPublica(ruta) },
    robots: !esEntornoIndexable()
      ? ROBOTS_PRIVADOS
      : ruta === '/ejemplo'
        ? {
            index: false,
            follow: true,
            googleBot: { index: false, follow: true, noimageindex: true, nosnippet: true },
          }
        : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
        },
    openGraph: {
      type: 'website',
      locale: 'es_CR',
      siteName: NOMBRE_SITIO,
      url: urlPublica(ruta),
      title: titulo,
      description: descripcion,
      images: [imagenCompartida],
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descripcion,
      images: [imagenCompartida],
    },
  }
}

export function serializarJsonLd(datos: unknown) {
  return JSON.stringify(datos).replace(/</g, '\\u003c')
}

export const datosSitio = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${ORIGEN_SITIO}/#organizacion`,
      name: NOMBRE_SITIO,
      url: urlPublica('/'),
      description: DESCRIPCION_SITIO,
      sameAs: ['https://www.facebook.com/groups/299591643850909'],
    },
    {
      '@type': 'WebSite',
      '@id': `${ORIGEN_SITIO}/#sitio`,
      name: NOMBRE_SITIO,
      alternateName: 'La Protectora',
      url: urlPublica('/'),
      inLanguage: 'es-CR',
      publisher: { '@id': `${ORIGEN_SITIO}/#organizacion` },
    },
    {
      '@type': 'WebPage',
      '@id': `${ORIGEN_SITIO}/#pagina`,
      name: 'Reseñas de inquilinos en Costa Rica',
      description: DESCRIPCION_SITIO,
      url: urlPublica('/'),
      inLanguage: 'es-CR',
      isPartOf: { '@id': `${ORIGEN_SITIO}/#sitio` },
      about: { '@id': `${ORIGEN_SITIO}/#organizacion` },
    },
  ],
}

export function datosPagina(ruta: Exclude<RutaPublica, '/'>, nombre: string, descripcion: string) {
  const url = urlPublica(ruta)
  const rutaGuia = ruta.startsWith('/guias/')
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#pagina`,
        url,
        name: nombre,
        description: descripcion,
        inLanguage: 'es-CR',
        isPartOf: { '@id': `${ORIGEN_SITIO}/#sitio` },
        breadcrumb: { '@id': `${url}#ruta` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#ruta`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: urlPublica('/') },
          ...(rutaGuia ? [{ '@type': 'ListItem', position: 2, name: 'Guías', item: urlPublica('/guias') }] : []),
          { '@type': 'ListItem', position: rutaGuia ? 3 : 2, name: nombre, item: url },
        ],
      },
    ],
  }
}
