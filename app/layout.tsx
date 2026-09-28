import type { Metadata, Viewport } from 'next'
import { Instrument_Sans } from 'next/font/google'
import Link from 'next/link'
import { cookies } from 'next/headers'
import './globals.css'
import { Nav } from '@/components/nav'
import { obtenerUsuario, puedeConsultar } from '@/lib/dal'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'La Protectora del Alquiler',
    template: '%s · La Protectora del Alquiler',
  },
  description:
    'Registro comunitario para consultar el historial de un inquilino antes de alquilar en Costa Rica. La cédula completa no es pública.',
  applicationName: 'La Protectora del Alquiler',
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
  const consulta = usuario ? await puedeConsultar(usuario) : false
  const guardado = (await cookies()).get('protectora-tema')?.value
  const tema = guardado === 'light' || guardado === 'dark' ? guardado : 'system'

  return (
    <html lang="es" data-scroll-behavior="smooth" data-theme={tema} className={`${instrumentSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#contenido" className="skip">
          Saltar al contenido
        </a>
        <Nav
          usuario={usuario ? { nombre: usuario.nombre, rol: usuario.rol, consulta } : null}
          tema={tema}
        />
        {usuario && !usuario.activo && (
          <p className="franja-aviso">
            {consulta
              ? 'Su cuenta está inactiva. Puede consultar el registro, no publicar.'
              : 'Su cuenta está inactiva. No puede publicar.'}
          </p>
        )}
        <main id="contenido" tabIndex={-1} className="flex-1">
          {props.children}
        </main>
        <footer className="pie-pagina">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-5 sm:px-6">
            <p className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>La Protectora del Alquiler</span>
              <Link href="/privacidad" className="underline-offset-4 hover:underline">
                Privacidad
              </Link>
            </p>
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
          </div>
        </footer>
      </body>
    </html>
  )
}
