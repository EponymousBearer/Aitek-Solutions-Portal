'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

import type { ProjectStatus } from '@aitek/types'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { MilestoneTracker } from '@/components/projects/milestone-tracker'
import { ProjectAgreements } from '@/components/projects/project-agreements'
import { ProjectDeliverables } from '@/components/projects/project-deliverables'
import { ProjectDocuments } from '@/components/projects/project-documents'
import { ProjectMessages } from '@/components/projects/project-messages'
import { ProjectOnboarding, type ProjectCompany } from '@/components/projects/project-onboarding'
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

export default function PortalProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId

  const { data, isLoading, error } = useQuery<ProjectDetail>({
    queryKey: ['project', projectId],
    queryFn: async () => (await api.get<{ data: ProjectDetail }>(`/projects/${projectId}`)).data.data,
    enabled: !!projectId,
  })

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/portal/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </Link>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Failed to load this project.
        </div>
      </div>
    )
  }

  const progress = projectProgress(data.status)
  const aitekTeam = (data.memberships ?? []).filter(
    (m) => m.role === 'AITEK_LEAD' || m.role === 'AITEK_MEMBER',
  )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/portal/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

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

      {/* Assigned AiTek team */}
      {aitekTeam.length > 0 && (
        <div className="space-y-3 rounded-xl border border-border bg-background p-5">
          <h2 className="text-sm font-semibold text-foreground">Your AiTek team</h2>
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

      {/* Milestones — client can approve / request changes */}
      <MilestoneTracker projectId={projectId} />

      {/* Deliverables — admin/PM add; client sees */}
      <ProjectDeliverables projectId={projectId} />

      {/* Messages */}
      <ProjectMessages projectId={projectId} />

      {/* Documents — client sees client-visible files */}
      <ProjectDocuments projectId={projectId} />

      {/* Agreements — client reviews + signs */}
      <ProjectAgreements projectId={projectId} />

      {/* Onboarding details */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">What you told us during onboarding</h2>
        <ProjectOnboarding company={data.company} />
      </div>
    </div>
  )
}
