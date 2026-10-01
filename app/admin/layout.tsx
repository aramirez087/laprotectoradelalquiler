import { NavAdmin } from '@/components/nav-admin'
import { SesionBorradoresAdmin } from '@/components/use-borrador-admin'
import { requerirRol } from '@/lib/dal'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requerirRol('admin')

  return (
    <div className="marco-admin">
      <div className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <NavAdmin />
        </div>
      </div>
      <SesionBorradoresAdmin key={usuario.id}>{children}</SesionBorradoresAdmin>
    </div>
  )
}
