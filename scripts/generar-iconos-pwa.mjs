import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Keep install icons in sync with the site's existing house mark.
// Run from any directory with: node scripts/generar-iconos-pwa.mjs
const raiz = new URL('../', import.meta.url)
const origen = await readFile(new URL('app/icon.svg', raiz), 'utf8')
const fondo = '#385443'
const contenido = origen.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')

await mkdir(new URL('public/icons/', raiz), { recursive: true })

const iconos = [
  ['public/icons/icon-192.png', 192, false],
  ['public/icons/icon-512.png', 512, false],
  ['public/icons/icon-maskable-512.png', 512, true],
  ['app/apple-icon.png', 180, false],
]

for (const [ruta, tamano, enmascarable] of iconos) {
  // The extra inset keeps the entire house inside the maskable safe circle.
  const svg = enmascarable
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${fondo}"/><g transform="translate(2.56 2.56) scale(0.84)">${contenido}</g></svg>`
    : origen

  await sharp(Buffer.from(svg))
    .resize(tamano, tamano)
    .flatten({ background: fondo })
    .png()
    .toFile(fileURLToPath(new URL(ruta, raiz)))

  console.log(`${ruta} (${tamano} × ${tamano})`)
}
