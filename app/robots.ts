import type { MetadataRoute } from 'next'
import { esEntornoIndexable, urlPublica } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  if (!esEntornoIndexable()) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  // Crawlers must reach private routes to read their noindex response headers.
  // Authentication continues to control access; robots.txt is not access control.
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: urlPublica('/sitemap.xml'),
  }
}
