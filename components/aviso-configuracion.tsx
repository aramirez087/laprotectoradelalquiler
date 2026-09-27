export function AvisoConfiguracion() {
  return (
    <p className="aviso aviso-atencion" role="status">
      El registro todavía no está conectado. Copie <code>.env.example</code> a <code>.env.local</code>,
      rellene las credenciales de Supabase y ejecute <code>npm run db:aplicar</code>.
    </p>
  )
}
