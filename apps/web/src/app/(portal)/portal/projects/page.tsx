'use client'

import Link from 'next/link'

import type { ProjectStatus } from '@aitek/types'
import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Loader2 } from 'lucide-react'

import { api } from '@/lib/api'
import { PROJECT_STATUS_LABELS, projectProgress, projectStatusBadgeClass } from '@/lib/project'

interface ProjectListItem {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  createdAt: string
}

export default function PortalProjectsPage() {
  const { data, isLoading, error } = useQuery<ProjectListItem[]>({
    queryKey: ['my-projects'],
    queryFn: async () => (await api.get<{ data: ProjectListItem[] }>('/projects')).data.data,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Your projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track the projects our team is delivering for you.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Failed to load your projects.
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background py-12 text-center">
          <FolderKanban className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No projects yet</p>
          <p className="text-xs text-muted-foreground">
            Once our team kicks off your engagement, it&apos;ll show up here.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {data?.map((p) => {
          const progress = projectProgress(p.status)
          return (
            <Link
              key={p.id}
              href={`/portal/projects/${p.id}`}
              className="group rounded-xl border border-border bg-background p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-foreground group-hover:text-primary">{p.name}</h2>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${projectStatusBadgeClass(p.status)}`}
                >
                  {PROJECT_STATUS_LABELS[p.status]}
                </span>
              </div>
              {p.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
              )}
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{progress.percent}%</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
