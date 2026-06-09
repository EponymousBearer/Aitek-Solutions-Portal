'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { FolderKanban, LayoutDashboard, MessageSquare, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

// Icons are resolved here (client side) from a serializable string key, so the
// Server Component layouts can pass plain nav data across the boundary.
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  messages: MessageSquare,
}

export interface InternalNavItem {
  href: string
  label: string
  icon: keyof typeof ICONS
  exact?: boolean
}

// Shared sidebar shell for the internal AiTek areas (PM / Developer). The admin
// area keeps its own richer sidebar.
export function InternalSidebar({
  subtitle,
  items,
}: {
  subtitle: string
  items: InternalNavItem[]
}) {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-background">
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-white">A</span>
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-foreground">AiTek Portal</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {items.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          const Icon = ICONS[item.icon] ?? LayoutDashboard
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
