import type { Metadata, Viewport } from 'next'
import { Instrument_Sans } from 'next/font/google'
import Link from 'next/link'
import { cookies } from 'next/headers'
import './globals.css'
import { Nav } from '@/components/nav'
import { AvisosAdmin } from '@/components/avisos-admin'
import { obtenerUsuario, accesoConsulta, horaServidor } from '@/lib/dal'
import { FranjaPermiso } from '@/components/permiso-consulta'
import { DESCRIPCION_SITIO, NOMBRE_SITIO, ORIGEN_SITIO, ROBOTS_PRIVADOS } from '@/lib/seo'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(ORIGEN_SITIO),
  title: {
    default: NOMBRE_SITIO,
    template: '%s · La Protectora del Alquiler',
  },
  description: DESCRIPCION_SITIO,
  applicationName: NOMBRE_SITIO,
  // Indexing is opt-in for public information, including future routes.
  robots: ROBOTS_PRIVADOS,
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION }
      : undefined,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#171a17' },
  ],
  colorScheme: 'light dark',
}

export default async function RootLayout(props: LayoutProps<'/'>) {
  const usuario = await obtenerUsuario()
  const acceso = usuario ? await accesoConsulta(usuario) : null
  const guardado = (await cookies()).get('protectora-tema')?.value
  const tema = guardado === 'light' || guardado === 'dark' ? guardado : 'system'

  return (
    <html lang="es-CR" data-scroll-behavior="smooth" data-theme={tema} className={`${instrumentSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#contenido" className="skip">
          Saltar al contenido
        </a>
        <Nav
          usuario={usuario ? { nombre: usuario.nombre, rol: usuario.rol, administra: usuario.rol === 'admin' && usuario.activo } : null}
          tema={tema}
        >
          {acceso && <FranjaPermiso acceso={acceso} ahoraServidor={horaServidor()} />}
        </Nav>
        <AvisosAdmin key={usuario?.id ?? 'publico'}>
          <main id="contenido" tabIndex={-1} className="flex-1">
            {props.children}
          </main>
        </AvisosAdmin>
        <footer className="pie-pagina">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-x-6 gap-y-3 px-4 py-6 sm:flex-row sm:items-center sm:px-6">
            <div>
              <p className="font-medium text-ink">La Protectora del Alquiler</p>
              <p className="mt-1">Experiencias de propietarios y agencias. Decisiones informadas.</p>
            </div>
            <nav aria-label="Información y comunidad" className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <Link href="/como-funciona" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                Cómo funciona
              </Link>
              <Link href="/privacidad" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                Privacidad
              </Link>
              <a
                href="https://www.facebook.com/groups/299591643850909"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 text-seal underline-offset-4 hover:underline"
              >
                Comunidad en Facebook
                <span aria-hidden="true">↗</span>
                <span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  )
}
