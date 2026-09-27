export function MensajeForm({ error, mensaje }: { error?: string; mensaje?: string }) {
  if (error) {
    return (
      <p role="alert" className="aviso aviso-error">
        {error}
      </p>
    )
  }
  if (mensaje) {
    return (
      <p role="status" className="aviso aviso-ok">
        {mensaje}
      </p>
    )
  }
  return null
}
