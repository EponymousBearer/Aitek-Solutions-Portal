'use client'

import { useState } from 'react'

import { AitekRole, MilestoneStatus } from '@aitek/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Plus, Target, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api } from '@/lib/api'
import { MILESTONE_STATUS_LABELS, milestoneStatusBadgeClass } from '@/lib/project'

interface Approval {
  id: string
  status: MilestoneStatus
  completionNote: string | null
  reviewComment: string | null
  requestedAt: string
  reviewedAt: string | null
  requestedBy: { firstName: string; lastName: string; email: string } | null
}

interface Milestone {
  id: string
  name: string
  description: string | null
  status: MilestoneStatus
  dueDate: string | null
  completedAt: string | null
  sortOrder: number
  approvals: Approval[]
}

function extractMessage(err: unknown, fallback: string): string {
  return typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
    ? (err as { response: { data: { message: string } } }).response.data.message
    : fallback
}

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString() : null)

export function MilestoneTracker({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const { user, isAdmin, isAitekTeam } = useCurrentUser()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Admin or the Project Manager create/edit/delete milestones.
  const canManage = isAdmin || user?.aitekRole === AitekRole.PROJECT_MANAGER
  // Any assigned AiTek member (incl. developers) can mark a milestone done
  // (submit it for the client's approval).
  const canSubmit = isAitekTeam
  // Clients (and admins) approve / request changes.
  const canApprove = isAdmin || (!!user && !isAitekTeam)

  const key = ['project-milestones', projectId]
  const { data, isLoading } = useQuery<Milestone[]>({
    queryKey: key,
    queryFn: async () =>
      (await api.get<{ data: Milestone[] }>(`/projects/${projectId}/milestones`)).data.data,
    enabled: !!projectId,
  })

  const invalidate = () => {
    setError(null)
    void queryClient.invalidateQueries({ queryKey: key })
  }
  const onErr = (err: unknown, fallback: string) => setError(extractMessage(err, fallback))

  const createMutation = useMutation({
    mutationFn: async () => {
      setError(null)
      await api.post(`/projects/${projectId}/milestones`, {
        name: name.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
      })
    },
    onSuccess: () => {
      setAdding(false)
      setName('')
      setDescription('')
      setDueDate('')
      invalidate()
    },
    onError: (err) => onErr(err, 'Failed to add milestone.'),
  })

  const completed = (data ?? []).filter((m) => m.status === MilestoneStatus.COMPLETED).length
  const total = data?.length ?? 0

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Milestones</h3>
          {total > 0 && (
            <span className="text-xs text-muted-foreground">
              {completed}/{total} complete
            </span>
          )}
        </div>
        {canManage && !adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add milestone
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {adding && canManage && (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Milestone name" />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Due</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 w-44"
            />
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !name.trim()}
              >
                {createMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">No milestones yet.</p>
      ) : (
        <ul className="space-y-2">
          {data!.map((m) => (
            <MilestoneRow
              key={m.id}
              projectId={projectId}
              milestone={m}
              canManage={canManage}
              canSubmit={canSubmit}
              canApprove={canApprove}
              onError={onErr}
              onChanged={invalidate}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function MilestoneRow({
  projectId,
  milestone: m,
  canManage,
  canSubmit,
  canApprove,
  onError,
  onChanged,
}: {
  projectId: string
  milestone: Milestone
  canManage: boolean
  canSubmit: boolean
  canApprove: boolean
  onError: (err: unknown, fallback: string) => void
  onChanged: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [completionNote, setCompletionNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reviewComment, setReviewComment] = useState('')

  const base = `/projects/${projectId}/milestones/${m.id}`
  const latest = m.approvals[0]

  const submit = useMutation({
    mutationFn: async () => {
      await api.post(`${base}/submit`, { completionNote: completionNote.trim() || undefined })
    },
    onSuccess: () => {
      setSubmitting(false)
      setCompletionNote('')
      onChanged()
    },
    onError: (err) => onError(err, 'Failed to submit milestone.'),
  })

  const approve = useMutation({
    mutationFn: async () => api.post(`${base}/approve`, {}),
    onSuccess: onChanged,
    onError: (err) => onError(err, 'Failed to approve milestone.'),
  })

  const reject = useMutation({
    mutationFn: async () => {
      await api.post(`${base}/reject`, { reviewComment: reviewComment.trim() || undefined })
    },
    onSuccess: () => {
      setRejecting(false)
      setReviewComment('')
      onChanged()
    },
    onError: (err) => onError(err, 'Failed to request changes.'),
  })

  const remove = useMutation({
    mutationFn: async () => api.delete(base),
    onSuccess: onChanged,
    onError: (err) => onError(err, 'Failed to delete milestone.'),
  })

  const due = fmtDate(m.dueDate)
  const isOpen = m.status === MilestoneStatus.PENDING || m.status === MilestoneStatus.IN_PROGRESS
  const isAwaiting = m.status === MilestoneStatus.AWAITING_APPROVAL
  const isDone = m.status === MilestoneStatus.COMPLETED

  return (
    <li className="rounded-md border border-border bg-muted/10 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isDone && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />}
            <span className="text-sm font-medium text-foreground">{m.name}</span>
            <span
              className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${milestoneStatusBadgeClass(m.status)}`}
            >
              {MILESTONE_STATUS_LABELS[m.status]}
            </span>
          </div>
          {m.description && <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>}
          {due && <p className="mt-0.5 text-[11px] text-muted-foreground">Due {due}</p>}

          {/* Submission note while awaiting approval */}
          {isAwaiting && latest?.completionNote && (
            <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              Submitted: {latest.completionNote}
            </p>
          )}
          {/* Feedback from a prior rejection */}
          {m.status === MilestoneStatus.IN_PROGRESS &&
            latest?.status === MilestoneStatus.REJECTED &&
            latest.reviewComment && (
              <p className="mt-1 rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">
                Changes requested: {latest.reviewComment}
              </p>
            )}
        </div>

        {canManage && (
          <button
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            title="Delete milestone"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* AiTek (incl. developers): mark done → submit for the client's approval */}
      {canSubmit && isOpen && (
        <div className="mt-2">
          {submitting ? (
            <div className="flex items-center gap-2">
              <Input
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                placeholder="Completion note (optional)"
                className="h-8"
              />
              <Button size="sm" onClick={() => submit.mutate()} disabled={submit.isPending}>
                {submit.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Send'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSubmitting(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setSubmitting(true)}>
              Mark as done
            </Button>
          )}
        </div>
      )}

      {/* Client/admin: approve or request changes */}
      {canApprove && isAwaiting && (
        <div className="mt-2">
          {rejecting ? (
            <div className="flex items-center gap-2">
              <Input
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="What needs to change?"
                className="h-8"
              />
              <Button size="sm" variant="destructive" onClick={() => reject.mutate()} disabled={reject.isPending}>
                {reject.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Send'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>
                {approve.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                Approve
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRejecting(true)}>
                Request changes
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
