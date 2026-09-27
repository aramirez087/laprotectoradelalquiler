import { Icono } from '@/components/icono'

export function BuscadorFichas({
  q,
  provincia,
  provincias,
}: {
  q: string
  provincia: string
  provincias: { id: number; nombre: string }[]
}) {
  return (
    <form
      action="/fichas"
      method="GET"
      className="panel-busqueda"
      role="search"
      aria-label="Buscar en el registro"
    >
      <div className="min-w-0 flex-1">
        <label className="etiqueta-campo" htmlFor="q">
          Nombre o cédula
        </label>
        <div className="relative">
          <Icono nombre="buscar" className="pointer-events-none absolute left-3.5 top-3.5 text-ink-soft" />
          <input
            id="q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="¿A quién desea consultar?"
            maxLength={150}
            className="campo pl-11"
          />
        </div>
      </div>
      <div className="min-w-0 sm:w-48">
        <label className="etiqueta-campo" htmlFor="provincia">
          Provincia
        </label>
        <select id="provincia" name="provincia" defaultValue={provincia} className="campo">
          <option value="">Todas las provincias</option>
          {provincias.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-primario">
        Buscar fichas
      </button>
    </form>
  )
}
