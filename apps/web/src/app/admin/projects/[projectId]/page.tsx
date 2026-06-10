'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'
import { useParams } from 'next/navigation'

import { ProjectStatus } from '@aitek/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

import { MilestoneTracker } from '@/components/projects/milestone-tracker'
import { ProjectAgreements } from '@/components/projects/project-agreements'
import { ProjectDocuments } from '@/components/projects/project-documents'
import { ProjectMessages } from '@/components/projects/project-messages'
import { ProjectOnboarding, type ProjectCompany } from '@/components/projects/project-onboarding'
import { ProjectTeam, type CompanyMemberOption } from '@/components/projects/project-team'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { ALL_PROJECT_STATUSES, PROJECT_STATUS_LABELS, projectProgress } from '@/lib/project'

interface ProjectDetail {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  startDate: string | null
  estimatedEndDate: string | null
  endDate: string | null
  createdAt: string
  company: ProjectCompany & {
    id: string
    name: string
    memberships?: CompanyMemberOption[]
  }
}

function extractMessage(err: unknown, fallback: string): string {
  return typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
    ? (err as { response: { data: { message: string } } }).response.data.message
    : fallback
}

const toDateInput = (iso: string | null): string => (iso ? iso.slice(0, 10) : '')

export default function AdminProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.DISCOVERY)
  const [startDate, setStartDate] = useState('')
  const [estimatedEndDate, setEstimatedEndDate] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<ProjectDetail>({
    queryKey: ['admin-project', projectId],
    queryFn: async () => (await api.get<{ data: ProjectDetail }>(`/projects/${projectId}`)).data.data,
    enabled: !!projectId,
  })

  useEffect(() => {
    if (data && !hydrated) {
      setName(data.name)
      setDescription(data.description ?? '')
      setStatus(data.status)
      setStartDate(toDateInput(data.startDate))
      setEstimatedEndDate(toDateInput(data.estimatedEndDate))
      setHydrated(true)
    }
  }, [data, hydrated])

  const saveMutation = useMutation({
    mutationFn: async () => {
      setActionError(null)
      await api.patch(`/projects/${projectId}`, {
        name,
        description,
        status,
        startDate,
        estimatedEndDate,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['admin-projects'] })
    },
    onError: (err) => setActionError(extractMessage(err, 'Failed to save.')),
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
        <Link href="/admin/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </Link>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Failed to load this project.
        </div>
      </div>
    )
  }

  const progress = projectProgress(status)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      {/* Editable project fields */}
      <div className="space-y-4 rounded-xl border border-border bg-background p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Client:{' '}
            <Link href={`/admin/clients/${data.company.id}`} className="text-primary hover:underline">
              {data.company.name}
            </Link>
          </p>
          <span className="text-xs text-muted-foreground">{progress.percent}% complete</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Project name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ALL_PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Start date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Est. completion</label>
            <Input
              type="date"
              value={estimatedEndDate}
              onChange={(e) => setEstimatedEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Progress preview */}
        <div className="flex items-center gap-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{progress.percent}%</span>
        </div>

        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        <div className="flex justify-end">
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim()}>
            {saveMutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-1 h-3 w-3" />
            )}
            Save changes
          </Button>
        </div>
      </div>

      {/* Team: lead PM, developers, client stakeholders */}
      <ProjectTeam projectId={projectId} companyMembers={data.company.memberships ?? []} />

      {/* Milestones */}
      <MilestoneTracker projectId={projectId} />

      {/* Messages */}
      <ProjectMessages projectId={projectId} />

      {/* Documents */}
      <ProjectDocuments projectId={projectId} />

      {/* Agreements */}
      <ProjectAgreements projectId={projectId} />

      {/* Onboarding submission */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Onboarding submission</h2>
        <ProjectOnboarding company={data.company} />
      </div>
    </div>
  )
}
