export function PasosRegistro({ actual }: { actual: 1 | 2 }) {
  return (
    <ol aria-label="Pasos para empezar" className="mb-7 grid grid-cols-2 gap-3">
      {['Su cuenta', 'Su primera reseña'].map((titulo, indice) => {
        const paso = indice + 1
        const completado = paso < actual
        return (
          <li
            key={titulo}
            aria-current={paso === actual ? 'step' : undefined}
            className={`flex items-center gap-2 border-t-2 pt-3 text-xs ${paso <= actual ? 'border-seal text-seal' : 'border-line text-ink-soft'}`}
          >
            <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-semibold ${paso <= actual ? 'bg-seal-soft' : 'bg-paper'}`}>
              {completado ? '✓' : paso}
            </span>
            <span className={paso === actual ? 'font-semibold' : ''}>
              <span className="sr-only">Paso {paso} de 2{completado ? ', completado' : ''}: </span>
              {titulo}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
