import { PortalGuard } from '@/components/layout/portal-guard'
import { PortalHeader } from '@/components/layout/portal-header'
import { PortalSidebar } from '@/components/layout/portal-sidebar'

// Auth state is per-request; don't pre-render or the wrong layout flashes.
export const dynamic = 'force-dynamic'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        <PortalSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <PortalHeader />
          <main className="flex-1 overflow-y-auto bg-slate-50/50 p-6">{children}</main>
        </div>
      </div>
    </PortalGuard>
  )
}
