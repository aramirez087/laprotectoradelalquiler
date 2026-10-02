import type { MetadataRoute } from 'next'
import { DESCRIPCION_SITIO, NOMBRE_SITIO } from '@/lib/seo'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: NOMBRE_SITIO,
    short_name: 'La Protectora',
    description: DESCRIPCION_SITIO,
    lang: 'es-CR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf9f5',
    theme_color: '#faf9f5',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
