'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  MessageSquare,
  FileSignature,
  Settings,
} from 'lucide-react'

import { BrandLogo } from '@/components/layout/brand-logo'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/portal/projects', label: 'Projects', icon: FolderKanban },
  { href: '/portal/documents', label: 'Documents', icon: FileText },
  { href: '/portal/messages', label: 'Messages', icon: MessageSquare },
  { href: '/portal/agreements', label: 'Agreements', icon: FileSignature },
  { href: '/portal/settings', label: 'Settings', icon: Settings },
]

export function PortalSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-4 dark:bg-white">
        <BrandLogo src="/logo-mark.webp" className="w-full" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
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
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
