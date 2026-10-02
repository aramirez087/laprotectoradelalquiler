export function CodigoDosFactores({ id = 'codigo-dos-factores' }: { id?: string }) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta-campo">Código de su aplicación</label>
      <input id={id} name="codigo" type="text" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]{6}" minLength={6} maxLength={6} required className="campo max-w-xs tracking-widest"
        aria-describedby={`${id}-ayuda`} />
      <p id={`${id}-ayuda`} className="mt-1 text-xs text-ink-soft">Escriba los 6 dígitos del código actual.</p>
    </div>
  )
}
