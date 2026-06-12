'use client'

import type { ProjectStatus } from '@aitek/types'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { MilestoneTracker } from '@/components/projects/milestone-tracker'
import { ProjectAgreements } from '@/components/projects/project-agreements'
import { ProjectDeliverables } from '@/components/projects/project-deliverables'
import { ProjectDocuments } from '@/components/projects/project-documents'
import type { ProjectCompany } from '@/components/projects/project-onboarding'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { PROJECT_STATUS_LABELS, projectProgress, projectStatusBadgeClass } from '@/lib/project'

interface ProjectMember {
  id: string
  userId: string
  role: 'AITEK_LEAD' | 'AITEK_MEMBER' | 'CLIENT_STAKEHOLDER'
  user: { id: string; firstName: string; lastName: string; email: string }
}

interface ProjectDetail {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  startDate: string | null
  estimatedEndDate: string | null
  endDate: string | null
  createdAt: string
  company: ProjectCompany & { id: string; name: string }
  memberships?: ProjectMember[]
}

function fmtDate(v: string | null): string {
  return v ? new Date(v).toLocaleDateString() : '—'
}

function memberName(u: { firstName: string; lastName: string; email: string }): string {
  return `${u.firstName} ${u.lastName}`.trim() || u.email
}

const AITEK_ROLE_LABEL: Record<string, string> = {
  AITEK_LEAD: 'Project Manager',
  AITEK_MEMBER: 'Developer',
}

// The project as the client sees it: header + AiTek team + tabs
// (Company info = milestones + documents, Deliverables, Agreements). Shared by
// the client portal project page and the admin client detail page so they stay
// identical. Self-fetches by projectId.
export function ProjectDetailView({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery<ProjectDetail>({
    queryKey: ['project', projectId],
    queryFn: async () =>
      (await api.get<{ data: ProjectDetail }>(`/projects/${projectId}`)).data.data,
    enabled: !!projectId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        Failed to load this project.
      </div>
    )
  }

  const progress = projectProgress(data.status)
  const aitekTeam = (data.memberships ?? []).filter(
    (m) => m.role === 'AITEK_LEAD' || m.role === 'AITEK_MEMBER',
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4 rounded-xl border border-border bg-background p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{data.name}</h1>
            {data.description && (
              <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${projectStatusBadgeClass(data.status)}`}
          >
            {PROJECT_STATUS_LABELS[data.status]}
          </span>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{progress.percent}%</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {progress.steps.map((s) => (
              <span
                key={s.key}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                  s.status === 'done'
                    ? 'bg-primary/10 text-primary'
                    : s.status === 'current'
                      ? 'bg-primary/5 text-primary ring-1 ring-primary/30'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Start</p>
            <p className="text-foreground">{fmtDate(data.startDate)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Est. completion</p>
            <p className="text-foreground">{fmtDate(data.estimatedEndDate)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Created</p>
            <p className="text-foreground">{fmtDate(data.createdAt)}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company info</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-6">
          {/* Assigned AiTek team */}
          {aitekTeam.length > 0 && (
            <div className="space-y-3 rounded-xl border border-border bg-background p-5">
              <h2 className="text-sm font-semibold text-foreground">AiTek team</h2>
              <ul className="space-y-1.5">
                {aitekTeam.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{memberName(m.user)}</span>
                    <span className="text-xs text-muted-foreground">
                      {AITEK_ROLE_LABEL[m.role] ?? 'Team'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <MilestoneTracker projectId={projectId} />
        </TabsContent>

        <TabsContent value="documents">
          <ProjectDocuments projectId={projectId} />
        </TabsContent>

        <TabsContent value="deliverables">
          <ProjectDeliverables projectId={projectId} />
        </TabsContent>

        <TabsContent value="agreements">
          <ProjectAgreements projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
