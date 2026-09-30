import assert from 'node:assert/strict'
import test from 'node:test'
import robots from '../app/robots.ts'
import sitemap from '../app/sitemap.ts'
import { datosPagina, datosSitio, metadataPublica, ORIGEN_SITIO, serializarJsonLd } from '../lib/seo.ts'

test('public discovery includes only canonical informational pages', () => {
  const anterior = process.env.VERCEL_ENV
  process.env.VERCEL_ENV = 'production'
  try {
    assert.deepEqual(sitemap().map(({ url }) => url), [
      `${ORIGEN_SITIO}/`, `${ORIGEN_SITIO}/como-funciona`, `${ORIGEN_SITIO}/privacidad`,
    ])
    assert.equal(robots().sitemap, `${ORIGEN_SITIO}/sitemap.xml`)
    assert.equal(robots().rules.allow, '/')
    assert.equal(robots().rules.disallow, undefined, 'crawlers must be able to see private noindex headers')
    assert.ok(sitemap().every((entrada) => !entrada.lastModified), 'do not invent modification dates')
  } finally {
    if (anterior === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = anterior
  }
})

test('each public page gets its own canonical and sharing metadata', () => {
  const metadata = metadataPublica({ titulo: 'Cómo funciona', descripcion: 'Información pública', ruta: '/como-funciona' })
  assert.deepEqual(metadata.title, { absolute: 'Cómo funciona' })
  assert.equal(metadata.alternates.canonical, `${ORIGEN_SITIO}/como-funciona`)
  assert.equal(metadata.openGraph.url, metadata.alternates.canonical)
  assert.equal(metadata.openGraph.locale, 'es_CR')
  assert.equal(metadata.openGraph.description, metadata.description)
  assert.equal(metadata.twitter.description, metadata.description)
  assert.equal(metadata.twitter.card, 'summary_large_image')
  assert.equal(metadata.openGraph.images[0].url, `${ORIGEN_SITIO}/opengraph-image`)
})

test('preview and development deployments cannot opt into public indexing', () => {
  const anterior = process.env.VERCEL_ENV
  try {
    for (const entorno of ['preview', 'development']) {
      process.env.VERCEL_ENV = entorno
      const metadata = metadataPublica({ titulo: 'Inicio', descripcion: 'Información', ruta: '/' })
      assert.equal(metadata.robots.index, false)
      assert.equal(metadata.robots.googleBot.index, false)
      assert.deepEqual(sitemap(), [])
      assert.deepEqual(robots(), { rules: { userAgent: '*', disallow: '/' } })
      assert.equal(metadata.alternates.canonical, `${ORIGEN_SITIO}/`)
    }
  } finally {
    if (anterior === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = anterior
  }
})

test('JSON-LD safely round trips strings that could terminate a script tag', () => {
  const datos = { text: '</script><script>alert("x")</script>', accented: 'reseñas y cédula' }
  const json = serializarJsonLd(datos)
  assert.ok(!json.includes('<'))
  assert.deepEqual(JSON.parse(json), datos)
})

test('public structured data has consistent identities and visible breadcrumbs', () => {
  assert.deepEqual(datosSitio['@graph'].map((dato) => dato['@type']), ['Organization', 'WebSite', 'WebPage'])
  assert.equal(datosSitio['@graph'][1].url, `${ORIGEN_SITIO}/`)
  const datos = datosPagina('/como-funciona', 'Cómo funciona', 'Proceso de registro')
  assert.equal(datos['@graph'][0].url, `${ORIGEN_SITIO}/como-funciona`)
  assert.deepEqual(datos['@graph'][1].itemListElement.map(({ item }) => item), [
    `${ORIGEN_SITIO}/`, `${ORIGEN_SITIO}/como-funciona`,
  ])
  assert.ok(!JSON.stringify(datosSitio).includes('SearchAction'), 'search requires authentication')
})
