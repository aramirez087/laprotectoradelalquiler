import type { Metadata, Viewport } from 'next'
import { Instrument_Sans } from 'next/font/google'
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
    { media: '(prefers-color-scheme: light)', color: '#f7f7f6' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
  colorScheme: 'light dark',
}

export default async function RootLayout(props: LayoutProps<'/'>) {
  const usuario = await obtenerUsuario()
  const consulta = usuario ? await puedeConsultar(usuario) : false

  return (
    <html lang="es" className={`${instrumentSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#contenido" className="skip">
          Saltar al contenido
        </a>
        <Nav usuario={usuario ? { nombre: usuario.nombre, rol: usuario.rol } : null} />
        {usuario && !usuario.activo && (
          <p className="franja-aviso">
            {consulta
              ? 'Su cuenta está inactiva. Puede consultar el registro, no publicar.'
              : 'Su cuenta está inactiva. No puede publicar.'}
          </p>
        )}
        <main id="contenido" className="flex-1">
          {props.children}
        </main>
      </body>
    </html>
  )
}
