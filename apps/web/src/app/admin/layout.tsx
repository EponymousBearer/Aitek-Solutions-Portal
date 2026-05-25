import { AdminGuard } from '@/components/layout/admin-guard'
import { AdminSidebar } from '@/components/layout/admin-sidebar'

// Auth state is per-request — do not pre-render.
export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Admin top header */}
          <header className="flex h-16 items-center justify-between border-b bg-background px-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Admin</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                AiTek Admin
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-slate-50/50 p-6">{children}</main>
        </div>
      </div>
    </AdminGuard>
  )
}
