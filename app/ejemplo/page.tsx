import Link from '@/components/enlace'
import { ConsultaEjemplo } from '@/components/consulta-ejemplo'
import { Icono } from '@/components/icono'
import { metadataPublica } from '@/lib/seo'

export const metadata = metadataPublica({
  titulo: 'Una consulta de ejemplo | La Protectora del Alquiler',
  descripcion: 'Explore una ficha ficticia sin registrarse. Conozca cómo leer las experiencias, qué información se protege y cómo obtener acceso a consultas reales.',
  ruta: '/ejemplo',
})

const pasos = [
  {
    titulo: 'Cree su cuenta',
    texto: 'El registro es para propietarios y agencias. Si usa correo y clave, confirme su correo para continuar.',
  },
  {
    titulo: 'Cuente su experiencia',
    texto: 'Identifique al inquilino, describa lo que vivió y elija si su nombre se muestra a otros miembros.',
  },
  {
    titulo: 'Espere la aprobación',
    texto: 'Administración revisa su reseña. Su primera reseña aprobada activa 3 meses de consultas gratis desde la aprobación.',
  },
]

export default function EjemploPage() {
  return (
    <article className="contenedor max-w-6xl space-y-6 py-6 sm:space-y-10 sm:py-10">
      <Link href="/" className="enlace-atras">← Volver al inicio</Link>

      <header className="max-w-3xl space-y-4">
        <p className="eyebrow">Antes de dar el primer paso</p>
        <h1 className="text-3xl sm:text-4xl">Así se ve una consulta</h1>
        <p className="max-w-2xl text-base leading-relaxed text-ink-soft">
          Explore una ficha ficticia y conozca las experiencias que podría consultar. Sin crear una cuenta.
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
        <div className="min-w-0 space-y-5">
          <ConsultaEjemplo />
          <div className="space-y-3">
            <Link href="/registro?origen=ejemplo" className="btn-primario max-w-full text-center leading-snug" data-evento-publico="ejemplo_registro">
              Compartir mi primera experiencia <Icono nombre="flecha" className="h-4 w-4 shrink-0" />
            </Link>
            <p className="text-sm leading-relaxed text-ink-soft">
              Su primera reseña aprobada activa 3 meses de consultas gratis.{' '}
              <a href="#comenzar-ejemplo" className="underline underline-offset-4">Vea los pasos para comenzar.</a>
            </p>
          </div>
        </div>

        <aside aria-labelledby="leer-ejemplo" className="min-w-0 space-y-6 border-t border-line pt-6 lg:border-t-0 lg:pt-0">
          <div className="space-y-3">
            <p className="eyebrow">Al consultar una ficha</p>
            <h2 id="leer-ejemplo" className="text-2xl">El contexto importa</h2>
          </div>

          <div className="space-y-2 border-t border-line pt-5">
            <h3 className="text-sm font-semibold">Confirme a quién está consultando</h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              Un nombre parecido no basta. Revise que la identidad corresponda a la persona que busca.
              El documento se muestra enmascarado a otros miembros; su visibilidad completa depende de los permisos.
            </p>
          </div>

          <div className="space-y-2 border-t border-line pt-5">
            <h3 className="text-sm font-semibold">Lea cada relato por separado</h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              Considere qué ocurrió y cuándo se publicó. Una experiencia es el relato de su autor.
              La revisión de administración no garantiza pagos ni el resultado de un nuevo alquiler.
            </p>
          </div>

          <div className="space-y-2 border-t border-line pt-5">
            <h3 className="text-sm font-semibold">Su nombre puede permanecer privado</h3>
            <p className="text-sm leading-relaxed text-ink-soft">
              Si elige publicar de forma anónima, otros miembros no ven su nombre.
              Administración sí puede identificar su cuenta durante la revisión.
            </p>
          </div>

          <div className="space-y-3 rounded-xl bg-seal-soft p-5 text-seal">
            <Icono nombre="escudo" />
            <p className="text-sm leading-relaxed">
              Las fichas reales requieren una cuenta y permiso de consulta vigente. No son un directorio público.
            </p>
            <Link href="/privacidad" className="enlace-texto text-sm">Cómo protegemos la información →</Link>
          </div>
        </aside>
      </div>

      <section aria-labelledby="comenzar-ejemplo" className="space-y-6 border-t border-line pt-8 sm:pt-10">
        <div className="max-w-2xl space-y-3">
          <p className="eyebrow">De su experiencia a una comunidad mejor informada</p>
          <h2 id="comenzar-ejemplo" className="text-2xl sm:text-3xl">Comparta lo que usted vivió</h2>
          <p className="text-sm leading-relaxed text-ink-soft">
            Su experiencia puede ayudar a otro propietario o agencia. Estos son los pasos para contribuir
            y acceder a las consultas reales.
          </p>
        </div>

        <ol className="grid gap-6 sm:grid-cols-3">
          {pasos.map(({ titulo, texto }, indice) => (
            <li key={titulo} className="space-y-3 border-t border-line pt-5">
              <span aria-hidden="true" className="numero-paso">{indice + 1}</span>
              <h3 className="text-base font-semibold">{titulo}</h3>
              <p className="text-sm leading-relaxed text-ink-soft">{texto}</p>
            </li>
          ))}
        </ol>

        <div className="space-y-3 pt-1">
          <Link
            href="/registro?origen=ejemplo"
            className="btn-primario inline-flex max-w-full text-center leading-snug"
            data-evento-publico="ejemplo_registro"
          >
            Compartir mi primera experiencia
            <Icono nombre="flecha" className="shrink-0" />
          </Link>
          <p className="text-sm leading-relaxed text-ink-soft">
            Crear la cuenta o enviar la reseña aún no activa el acceso. La revisión es manual.
          </p>
          <Link href="/como-funciona" className="enlace-texto text-sm">Conocer todos los detalles del acceso →</Link>
        </div>
      </section>
    </article>
  )
}
