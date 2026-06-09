import { AdminUserMenu } from '@/components/layout/admin-user-menu'
import { InternalSidebar, type InternalNavItem } from '@/components/layout/internal-sidebar'
import { RequireInternalRole } from '@/components/layout/require-internal-role'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { NotificationBell } from '@/components/notifications/notification-bell'

// Auth state is per-request — do not pre-render.
export const dynamic = 'force-dynamic'

const NAV: InternalNavItem[] = [
  { href: '/pm', label: 'My Projects', icon: 'dashboard', exact: true },
  { href: '/pm/messages', label: 'Messages', icon: 'messages' },
]

export default function PmLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireInternalRole area="PM">
      <div className="flex h-screen overflow-hidden bg-background">
        <InternalSidebar items={NAV} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 items-center justify-between border-b bg-background px-6">
            <span className="text-sm font-medium text-foreground">Project Manager</span>
            <div className="flex items-center gap-3">
              <span className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                Project Manager
              </span>
              <ThemeToggle />
              <NotificationBell />
              <AdminUserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-canvas p-6">{children}</main>
        </div>
      </div>
    </RequireInternalRole>
  )
}
