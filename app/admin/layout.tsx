import { NavAdmin } from '@/components/nav-admin'
import { requerirRol } from '@/lib/dal'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requerirRol('admin')

  return (
    <div>
      <div className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <NavAdmin />
        </div>
      </div>
      {children}
    </div>
  )
}
