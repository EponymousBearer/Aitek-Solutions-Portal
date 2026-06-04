'use client'

import Link from 'next/link'

import type { ProjectStatus } from '@aitek/types'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Loader2 } from 'lucide-react'

import { api } from '@/lib/api'
import { PROJECT_STATUS_LABELS, projectProgress, projectStatusBadgeClass } from '@/lib/project'

interface MyProject {
  id: string
  name: string
  status: ProjectStatus
  createdAt: string
  company: { id: string; name: string }
}

// Lists the projects the current user can see (the API scopes /projects by
// membership), linking each to `${basePath}/projects/:id`. Shared by the PM and
// developer dashboards.
export function MyProjectsList({ basePath }: { basePath: string }) {
  const { data, isLoading, error } = useQuery<MyProject[]>({
    queryKey: ['my-projects', basePath],
    queryFn: async () => (await api.get<{ data: MyProject[] }>('/projects')).data.data,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        Failed to load your projects.
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background py-12 text-center">
        <FolderKanban className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No projects assigned yet</p>
        <p className="text-xs text-muted-foreground">
          Once you’re assigned to a project, it shows up here.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5">Project</th>
            <th className="px-4 py-2.5">Client</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5">Progress</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => {
            const progress = projectProgress(p.status)
            return (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link
                    href={`${basePath}/projects/${p.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground">{p.company.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${projectStatusBadgeClass(p.status)}`}
                  >
                    {PROJECT_STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{progress.percent}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
