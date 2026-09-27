export function MarcoAcceso({
  titulo,
  texto,
  children,
}: {
  titulo: string
  texto: string
  children: React.ReactNode
}) {
  return (
    <div className="contenedor">
      <div className="grid items-start gap-10 lg:grid-cols-2 lg:items-center">
        <aside className="order-2 space-y-4 lg:order-1">
          <p className="eyebrow">Costa Rica</p>
          <p className="font-display text-4xl leading-none tracking-tight text-ink sm:text-5xl">{titulo}</p>
          <p className="max-w-md text-lg text-ink-soft">{texto}</p>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li>Consulte una ficha antes de entregar las llaves.</li>
            <li>Escriba solo lo que vivió y puede respaldar.</li>
            <li>La cédula completa no se muestra al público.</li>
          </ul>
        </aside>
        <div className="expediente order-1 lg:order-2">{children}</div>
      </div>
    </div>
  )
}
