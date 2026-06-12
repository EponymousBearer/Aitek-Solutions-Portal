'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

import { ProjectStatus } from '@aitek/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save } from 'lucide-react'

import { MilestoneTracker } from '@/components/projects/milestone-tracker'
import { ProjectAgreements } from '@/components/projects/project-agreements'
import { ProjectDeliverables } from '@/components/projects/project-deliverables'
import { ProjectDocuments } from '@/components/projects/project-documents'
import type { ProjectCompany } from '@/components/projects/project-onboarding'
import { ProjectTeam, type CompanyMemberOption } from '@/components/projects/project-team'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  company: ProjectCompany & { id: string; name: string; memberships?: CompanyMemberOption[] }
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

// Internal team view of a project, shared by the PM area (canEdit) and the
// developer area (read-only). `backHref` is the area's project list.
export function InternalProjectDetail({
  projectId,
  backHref,
  canEdit,
}: {
  projectId: string
  backHref: string
  canEdit: boolean
}) {
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.DISCOVERY)
  const [startDate, setStartDate] = useState('')
  const [estimatedEndDate, setEstimatedEndDate] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<ProjectDetail>({
    queryKey: ['internal-project', projectId],
    queryFn: async () =>
      (await api.get<{ data: ProjectDetail }>(`/projects/${projectId}`)).data.data,
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
      void queryClient.invalidateQueries({ queryKey: ['internal-project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['my-projects'] })
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
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
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
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div className="space-y-4 rounded-xl border border-border bg-background p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Client: <span className="text-foreground">{data.company.name}</span>
          </p>
          <span className="text-xs text-muted-foreground">{progress.percent}% complete</span>
        </div>

        {canEdit ? (
          <>
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
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-foreground">{data.name}</h1>
                {data.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{data.description}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {PROJECT_STATUS_LABELS[status]}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{progress.percent}%</span>
        </div>

        {canEdit && (
          <>
            {actionError && <p className="text-sm text-destructive">{actionError}</p>}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !name.trim()}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Save className="mr-1 h-3 w-3" />
                )}
                Save changes
              </Button>
            </div>
          </>
        )}
      </div>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company info</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          {/* Developers (read-only area) don't see agreements; PMs do. */}
          {canEdit && <TabsTrigger value="agreements">Agreements</TabsTrigger>}
        </TabsList>

        <TabsContent value="company" className="space-y-6">
          {/* Team — controls self-gate: the lead PM can manage, developers see read-only */}
          <ProjectTeam projectId={projectId} companyMembers={data.company.memberships ?? []} />

          {/* Milestones — AiTek team can create/edit/submit */}
          <MilestoneTracker projectId={projectId} />

          {/* Documents */}
          <ProjectDocuments projectId={projectId} />
        </TabsContent>

        <TabsContent value="deliverables">
          <ProjectDeliverables projectId={projectId} />
        </TabsContent>

        {canEdit && (
          <TabsContent value="agreements">
            <ProjectAgreements projectId={projectId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
