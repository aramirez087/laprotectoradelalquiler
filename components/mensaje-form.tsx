export function MensajeForm({ error, mensaje }: { error?: string; mensaje?: string }) {
  if (error) {
    return (
      <p role="alert" tabIndex={-1} className="aviso aviso-error scroll-mt-28 scroll-mb-8">
        {error}
      </p>
    )
  }
  if (mensaje) {
    return (
      <p role="status" tabIndex={-1} className="aviso aviso-ok scroll-mt-28 scroll-mb-8">
        {mensaje}
      </p>
    )
  }
  return null
}
