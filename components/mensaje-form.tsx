export function MensajeForm({ error, mensaje }: { error?: string; mensaje?: string }) {
  if (error) {
    return (
      <p role="alert" tabIndex={-1} className="aviso aviso-error">
        {error}
      </p>
    )
  }
  if (mensaje) {
    return (
      <p role="status" tabIndex={-1} className="aviso aviso-ok">
        {mensaje}
      </p>
    )
  }
  return null
}
