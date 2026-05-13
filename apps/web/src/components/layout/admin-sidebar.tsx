'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  LayoutDashboard,
  Users,
  FolderKanban,
  ShieldCheck,
  FileQuestion,
  Briefcase,
  FileText,
  Receipt,
  UserCog,
} from 'lucide-react'

import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/kyc', label: 'KYC Review', icon: ShieldCheck },
  { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
  { href: '/admin/questionnaires', label: 'Questionnaires', icon: FileQuestion },
  { href: '/admin/services', label: 'Services', icon: Briefcase },
  { href: '/admin/agreements', label: 'Agreements', icon: FileText },
  { href: '/admin/invoices', label: 'Invoices', icon: Receipt },
  { href: '/admin/team', label: 'Team', icon: UserCog },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-white">A</span>
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-foreground">AiTek Portal</p>
          <p className="text-xs text-muted-foreground">Admin</p>
        </div>
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

      {/* Portal link */}
      <div className="border-t p-3">
        <Link
          href="/portal"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          ← Back to Client Portal
        </Link>
      </div>
    </aside>
  )
}
