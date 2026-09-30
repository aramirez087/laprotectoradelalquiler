import type { MetadataRoute } from 'next'
import { esEntornoIndexable, RUTAS_PUBLICAS, urlPublica } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  if (!esEntornoIndexable()) return []
  // No fabricated lastModified dates: add dates only from a real content history.
  return RUTAS_PUBLICAS.map((ruta) => ({ url: urlPublica(ruta) }))
}
