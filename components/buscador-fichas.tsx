import { FormularioBusqueda } from '@/components/formulario-busqueda'
import { Icono } from '@/components/icono'

export function BuscadorFichas({ q }: { q: string }) {
  return (
    <FormularioBusqueda
      action="/fichas"

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
            key={q}
            id="q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nombre o cédula"
            maxLength={150}
            className="campo pl-11"
            autoComplete="off"
          />
        </div>
      </div>
      <button type="submit" className="btn-primario">
        Buscar reseñas
      </button>
    </FormularioBusqueda>
  )
}
