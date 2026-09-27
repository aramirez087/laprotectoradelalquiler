import Link from 'next/link'

function ventana(actual: number, total: number) {
  const nums = new Set<number>([1, total])
  for (let n = actual - 2; n <= actual + 2; n += 1) nums.add(n)
  return [...nums].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
}

export function Paginacion({
  pagina,
  paginas,
  href,
}: {
  pagina: number
  paginas: number
  href: (n: number) => string
}) {
  if (paginas <= 1) return null

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Páginas">
      {pagina > 1 ? (
        <Link href={href(pagina - 1)} className="btn-secundario">
          Anterior
        </Link>
      ) : (
        <span className="px-3 text-sm text-ink-soft">Anterior</span>
      )}
      <span className="text-sm text-ink-soft sm:hidden">
        {pagina} de {paginas}
      </span>
      <div className="hidden items-center gap-2 sm:flex">
        {ventana(pagina, paginas).map((n, i, lista) => {
          const previo = lista[i - 1]
          const salto = previo != null && n - previo > 1
          return (
            <span key={n} className="contents">
              {salto && <span className="px-1 text-ink-soft">…</span>}
              <Link
                href={href(n)}
                aria-label={`Página ${n}`}
                aria-current={n === pagina ? 'page' : undefined}
                className={n === pagina ? 'btn-primario' : 'btn-secundario'}
              >
                {n}
              </Link>
            </span>
          )
        })}
      </div>
      {pagina < paginas ? (
        <Link href={href(pagina + 1)} className="btn-secundario">
          Siguiente
        </Link>
      ) : (
        <span className="px-3 text-sm text-ink-soft">Siguiente</span>
      )}
    </nav>
  )
}
