import path from 'node:path'
import { pathToFileURL } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const relative = specifier.slice(2)
    const file = path.join(process.cwd(), relative.endsWith('.ts') ? relative : `${relative}.ts`)
    return nextResolve(pathToFileURL(file).href, context)
  }
  return nextResolve(specifier, context)
}
