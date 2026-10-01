import assert from 'node:assert/strict'

// Run against a production build without authentication:
// node scripts/verificar-seo.mjs http://127.0.0.1:3107
// After deployment, omit the argument to check the public production site.
const origenCanonico = 'https://www.protectoradelalquiler.com'
const base = new URL(process.argv[2] || origenCanonico)
assert.ok(['http:', 'https:'].includes(base.protocol), 'La URL debe usar HTTP o HTTPS')
assert.ok(!base.username && !base.password && !base.search, 'Use una URL sin credenciales ni parámetros')

function atributos(etiqueta) {
  return Object.fromEntries([...etiqueta.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, nombre, valor]) => [nombre, valor]))
}

function meta(html, nombre) {
  const etiquetas = [...html.matchAll(/<meta\b[^>]*>/g)].map(([etiqueta]) => atributos(etiqueta))
  return etiquetas.find((etiqueta) => etiqueta.name === nombre || etiqueta.property === nombre)?.content
}

async function solicitar(ruta) {
  return fetch(new URL(ruta, base), {
    redirect: 'manual',
    headers: { 'User-Agent': 'Twitterbot/1.0' },
    signal: AbortSignal.timeout(15000),
  })
}

const titulos = new Set()
const descripciones = new Set()
for (const ruta of ['/', '/como-funciona', '/privacidad']) {
  const respuesta = await solicitar(ruta)
  assert.equal(respuesta.status, 200, `${ruta}: debe responder 200`)
  assert.ok(!respuesta.headers.get('x-robots-tag')?.includes('noindex'), `${ruta}: no debe excluirse`)
  const html = await respuesta.text()
  const cabecera = html.match(/<head>([\s\S]*?)<\/head>/)?.[1]
  assert.ok(cabecera, `${ruta}: falta <head>`)
  const titulo = cabecera.match(/<title>([^<]+)<\/title>/)?.[1]
  const descripcion = meta(cabecera, 'description')
  assert.ok(titulo && descripcion, `${ruta}: título y descripción deben estar en <head>`)
  assert.ok(!titulos.has(titulo) && !descripciones.has(descripcion), `${ruta}: metadatos duplicados`)
  titulos.add(titulo)
  descripciones.add(descripcion)
  const enlaces = [...cabecera.matchAll(/<link\b[^>]*>/g)].map(([etiqueta]) => atributos(etiqueta))
  assert.equal(new URL(enlaces.find(({ rel }) => rel === 'canonical')?.href || '').href, `${origenCanonico}${ruta}`)
  assert.ok(meta(cabecera, 'robots')?.includes('index, follow'), `${ruta}: debe ser indexable`)
  assert.ok(!meta(cabecera, 'robots')?.includes('noindex'), `${ruta}: noindex inesperado`)
  assert.equal(new URL(meta(cabecera, 'og:url') || '').href, `${origenCanonico}${ruta}`)
  assert.equal(meta(cabecera, 'og:title'), titulo)
  assert.equal(meta(cabecera, 'og:description'), descripcion)
  assert.ok(meta(cabecera, 'og:image')?.startsWith(`${origenCanonico}/opengraph-image`))
  assert.equal(meta(cabecera, 'twitter:card'), 'summary_large_image')
  assert.equal(meta(cabecera, 'twitter:description'), descripcion)
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${ruta}: debe tener un solo H1`)
  if (ruta === '/') {
    assert.match(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '', /Proteja su propiedad/)
    assert.match(html, /id="resenas-inquilinos"/)
  }
  assert.match(html, /<html[^>]+lang="es-CR"/)
  assert.match(html, /href="\/como-funciona"/)
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs]) => atributos(attrs).type === 'application/ld+json')
  assert.equal(scripts.length, 1, `${ruta}: falta el grafo JSON-LD`)
  const politica = respuesta.headers.get('content-security-policy')
  const datos = scripts.map(([, attrs, contenido]) => {
    const nonce = atributos(attrs).nonce
    assert.ok(nonce && politica?.includes(`'nonce-${nonce}'`), `${ruta}: JSON-LD debe respetar CSP`)
    return JSON.parse(contenido)
  })
  assert.equal(datos[0]['@context'], 'https://schema.org')
  assert.ok(datos[0]['@graph'].some((entidad) => entidad['@type'] === 'WebPage'))
  console.log(`✓ ${ruta}: metadatos, canonical, H1 y JSON-LD correctos`)
}

const respuestaRobots = await solicitar('/robots.txt')
assert.equal(respuestaRobots.status, 200)
const robots = await respuestaRobots.text()
assert.match(robots, /Allow: \/\s/)
assert.match(robots, /Sitemap: https:\/\/www\.protectoradelalquiler\.com\/sitemap\.xml/)
assert.ok(!robots.includes('Disallow:'), 'Los rastreadores deben poder observar noindex')
const respuestaSitemap = await solicitar('/sitemap.xml')
assert.equal(respuestaSitemap.status, 200)
const sitemap = await respuestaSitemap.text()
assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url), [
  `${origenCanonico}/`, `${origenCanonico}/como-funciona`, `${origenCanonico}/privacidad`,
])
console.log('✓ robots.txt y sitemap.xml: solo páginas públicas canónicas')

const ejemplo = await solicitar('/ejemplo')
assert.equal(ejemplo.status, 200, 'El ejemplo debe estar disponible sin iniciar sesión')
assert.match(ejemplo.headers.get('x-robots-tag') || '', /noindex/)
const htmlEjemplo = await ejemplo.text()
assert.ok(meta(htmlEjemplo, 'robots')?.includes('noindex'))
assert.equal(meta(htmlEjemplo, 'og:url'), `${origenCanonico}/ejemplo`)
assert.match(htmlEjemplo, /Ejemplo ficticio/)
assert.equal([...htmlEjemplo.matchAll(/<h1\b/g)].length, 1)
console.log('✓ Consulta de ejemplo: pública, ficticia y excluida de indexación')

for (const ruta of ['/login', '/registro', '/recuperar', '/restablecer', '/perfil', '/fichas', '/fichas/1', '/resenas/nueva', '/registro/resena', '/admin', '/admin/reportes/csv', '/invitacion/admin', '/auth/facebook/datos']) {
  const respuesta = await solicitar(ruta)
  assert.ok(respuesta.status < 500, `${ruta}: error del servidor`)
  assert.match(respuesta.headers.get('x-robots-tag') || '', /noindex/, `${ruta}: falta X-Robots-Tag`)
  if (respuesta.status === 200) {
    const html = await respuesta.text()
    assert.ok(meta(html, 'robots')?.includes('noindex'), `${ruta}: falta meta noindex`)
  } else {
    await respuesta.body?.cancel()
  }
}
console.log('✓ 13 rutas privadas: noindex incluso en redirecciones')

const imagen = await solicitar('/opengraph-image')
assert.equal(imagen.status, 200)
assert.match(imagen.headers.get('content-type') || '', /image\/png/)
const png = new DataView(await imagen.arrayBuffer())
assert.equal(png.getUint32(16), 1200)
assert.equal(png.getUint32(20), 630)
console.log('✓ Imagen compartida: PNG de 1200 × 630')

const inexistente = await solicitar('/pagina-inexistente-verificacion-seo')
assert.equal(inexistente.status, 404, 'Una página inexistente debe responder 404')
await inexistente.body?.cancel()
console.log('✓ Las páginas inexistentes responden 404')
