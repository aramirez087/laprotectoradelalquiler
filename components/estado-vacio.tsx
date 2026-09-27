import { Icono } from '@/components/icono'

export function EstadoVacio({
  titulo,
  texto,
  children,
}: {
  titulo: string
  texto: string
  children?: React.ReactNode
}) {
  return (
    <div className="estado-vacio">
      <span className="icono-estado">
        <Icono nombre="buscar" />
      </span>
      <h2 className="mt-4 text-xl">{titulo}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{texto}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  )
}
