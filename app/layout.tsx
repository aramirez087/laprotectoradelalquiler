import type { Metadata, Viewport } from 'next'
import { Instrument_Sans } from 'next/font/google'
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
    <html lang="es" data-theme={tema} className={`${instrumentSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#contenido" className="skip">
          Saltar al contenido
        </a>
        <Nav usuario={usuario ? { nombre: usuario.nombre, rol: usuario.rol } : null} tema={tema} />
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
            <p>La Protectora del Alquiler</p>
            <p className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-moss" aria-hidden="true" />Comunidad de alquiler · Costa Rica</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
