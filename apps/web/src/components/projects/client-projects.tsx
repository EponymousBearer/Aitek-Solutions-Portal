'use client'

import { useState } from 'react'

import Link from 'next/link'

import type { ProjectStatus } from '@aitek/types'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ExternalLink, FolderKanban, Loader2 } from 'lucide-react'

import { ProjectDetailView } from '@/components/projects/project-detail-view'
import { api } from '@/lib/api'
import { PROJECT_STATUS_LABELS, projectStatusBadgeClass } from '@/lib/project'

interface ProjectListItem {
  id: string
  name: string
  status: ProjectStatus
  _count?: { milestones: number }
}

// The client's projects, each expandable into the full project detail (the same
// view the client sees). Used on the admin client detail page.
export function ClientProjects({ companyId }: { companyId: string }) {
  const [openId, setOpenId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<ProjectListItem[]>({
    queryKey: ['client-projects', companyId],
    queryFn: async () =>
      (await api.get<{ data: ProjectListItem[] }>(`/projects?companyId=${companyId}`)).data.data,
    enabled: !!companyId,
  })

  const projects = data ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FolderKanban className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Projects</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">This client has no projects yet.</p>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const open = openId === p.id
            return (
              <div key={p.id} className="overflow-hidden rounded-xl border border-border bg-background">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : p.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate text-sm font-medium text-foreground">{p.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${projectStatusBadgeClass(p.status)}`}
                    >
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                  </button>
                  <Link
                    href={`/admin/projects/${p.id}`}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                    title="Open the full project page (edit, team, messages)"
                  >
                    Manage <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                {open && (
                  <div className="border-t border-border bg-muted/20 p-4">
                    <ProjectDetailView projectId={p.id} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
