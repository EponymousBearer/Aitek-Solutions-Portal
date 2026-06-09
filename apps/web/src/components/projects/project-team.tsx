'use client'

import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Crown, Loader2, Plus, UserMinus, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api } from '@/lib/api'

type ProjectMembershipRole = 'AITEK_LEAD' | 'AITEK_MEMBER' | 'CLIENT_STAKEHOLDER'

interface MemberUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  aitekRole: 'PROJECT_MANAGER' | 'DEVELOPER' | null
}

interface Membership {
  id: string
  userId: string
  role: ProjectMembershipRole
  user: MemberUser
}

interface MembersResponse {
  leadUserId: string | null
  members: Membership[]
}

interface TeamOption {
  id: string
  email: string
  firstName: string
  lastName: string
}

// The client company's users, as loaded with the project detail — candidates
// for client-stakeholder access.
export interface CompanyMemberOption {
  user: { id: string; email: string; firstName: string; lastName: string; role: string }
}

function displayName(u: { firstName: string; lastName: string; email: string }): string {
  const name = `${u.firstName} ${u.lastName}`.trim()
  return name || u.email
}

function extractMessage(err: unknown, fallback: string): string {
  return typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
    ? (err as { response: { data: { message: string } } }).response.data.message
    : fallback
}

export function ProjectTeam({
  projectId,
  companyMembers,
}: {
  projectId: string
  companyMembers: CompanyMemberOption[]
}) {
  const queryClient = useQueryClient()
  const { user, isAdmin } = useCurrentUser()
  const [actionError, setActionError] = useState<string | null>(null)

  const membersKey = ['project-members', projectId]

  const { data, isLoading } = useQuery<MembersResponse>({
    queryKey: membersKey,
    queryFn: async () =>
      (await api.get<{ data: MembersResponse }>(`/projects/${projectId}/members`)).data.data,
    enabled: !!projectId,
  })

  const lead = data?.members.find((m) => m.role === 'AITEK_LEAD')
  const developers = data?.members.filter((m) => m.role === 'AITEK_MEMBER') ?? []
  const stakeholders = data?.members.filter((m) => m.role === 'CLIENT_STAKEHOLDER') ?? []

  // The lead PM (or any admin) manages developers & stakeholders.
  const canManage = isAdmin || (!!user && data?.leadUserId === user.id)

  const onMutationError = (err: unknown, fallback: string) =>
    setActionError(extractMessage(err, fallback))
  const invalidate = () => {
    setActionError(null)
    void queryClient.invalidateQueries({ queryKey: membersKey })
    void queryClient.invalidateQueries({ queryKey: ['admin-project', projectId] })
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
      </div>
    )
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Project team</h3>
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {/* Project Manager (lead) */}
      <LeadSection
        projectId={projectId}
        lead={lead}
        isAdmin={isAdmin}
        onError={onMutationError}
        onChanged={invalidate}
      />

      {/* Developers */}
      <MemberSection
        title="Developers"
        emptyLabel="No developers assigned."
        projectId={projectId}
        members={developers}
        canManage={canManage}
        role="AITEK_MEMBER"
        teamRoleFilter="DEVELOPER"
        onError={onMutationError}
        onChanged={invalidate}
      />

      {/* Client stakeholders */}
      <StakeholderSection
        projectId={projectId}
        members={stakeholders}
        companyMembers={companyMembers}
        canManage={canManage}
        onError={onMutationError}
        onChanged={invalidate}
      />
    </div>
  )
}

// ── Lead ───────────────────────────────────────────────

function LeadSection({
  projectId,
  lead,
  isAdmin,
  onError,
  onChanged,
}: {
  projectId: string
  lead: Membership | undefined
  isAdmin: boolean
  onError: (err: unknown, fallback: string) => void
  onChanged: () => void
}) {
  const [picking, setPicking] = useState(false)
  const [selected, setSelected] = useState('')

  const { data: pms } = useQuery<TeamOption[]>({
    queryKey: ['team', 'PROJECT_MANAGER'],
    queryFn: async () =>
      (await api.get<{ data: TeamOption[] }>('/team?aitekRole=PROJECT_MANAGER')).data.data,
    enabled: isAdmin && picking,
  })

  const assign = useMutation({
    mutationFn: async () => {
      await api.post(`/projects/${projectId}/lead`, { userId: selected })
    },
    onSuccess: () => {
      setPicking(false)
      setSelected('')
      onChanged()
    },
    onError: (err) => onError(err, 'Failed to assign the project manager.'),
  })

  const remove = useMutation({
    mutationFn: async () => {
      await api.delete(`/projects/${projectId}/lead`)
    },
    onSuccess: onChanged,
    onError: (err) => onError(err, 'Failed to remove the project manager.'),
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Project Manager
        </p>
        {isAdmin && !picking && (
          <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
            {lead ? 'Change' : 'Assign'}
          </Button>
        )}
      </div>

      {lead ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            {displayName(lead.user)}
          </span>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <UserMinus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No project manager assigned.</p>
      )}

      {picking && isAdmin && (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select a project manager…</option>
            {pms?.map((p) => (
              <option key={p.id} value={p.id}>
                {displayName(p)}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => assign.mutate()} disabled={!selected || assign.isPending}>
            {assign.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Assign'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPicking(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Developers (AITEK_MEMBER) ──────────────────────────

function MemberSection({
  title,
  emptyLabel,
  projectId,
  members,
  canManage,
  role,
  teamRoleFilter,
  onError,
  onChanged,
}: {
  title: string
  emptyLabel: string
  projectId: string
  members: Membership[]
  canManage: boolean
  role: ProjectMembershipRole
  teamRoleFilter: 'DEVELOPER' | 'PROJECT_MANAGER'
  onError: (err: unknown, fallback: string) => void
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState('')

  const { data: options } = useQuery<TeamOption[]>({
    queryKey: ['team', teamRoleFilter],
    queryFn: async () =>
      (await api.get<{ data: TeamOption[] }>(`/team?aitekRole=${teamRoleFilter}`)).data.data,
    enabled: canManage && adding,
  })

  const assignedIds = new Set(members.map((m) => m.userId))
  const candidates = (options ?? []).filter((o) => !assignedIds.has(o.id))

  const add = useMutation({
    mutationFn: async () => {
      await api.post(`/projects/${projectId}/members`, { userId: selected, role })
    },
    onSuccess: () => {
      setAdding(false)
      setSelected('')
      onChanged()
    },
    onError: (err) => onError(err, 'Failed to add member.'),
  })

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/projects/${projectId}/members/${userId}`)
    },
    onSuccess: onChanged,
    onError: (err) => onError(err, 'Failed to remove member.'),
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        {canManage && !adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-md border border-border bg-muted/10 px-3 py-1.5"
            >
              <span className="text-sm text-foreground">{displayName(m.user)}</span>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(m.userId)}
                  disabled={remove.isPending}
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && canManage && (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select…</option>
            {candidates.map((o) => (
              <option key={o.id} value={o.id}>
                {displayName(o)}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => add.mutate()} disabled={!selected || add.isPending}>
            {add.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Client stakeholders (CLIENT_STAKEHOLDER) ───────────

function StakeholderSection({
  projectId,
  members,
  companyMembers,
  canManage,
  onError,
  onChanged,
}: {
  projectId: string
  members: Membership[]
  companyMembers: CompanyMemberOption[]
  canManage: boolean
  onError: (err: unknown, fallback: string) => void
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState('')

  const assignedIds = new Set(members.map((m) => m.userId))
  const candidates = companyMembers.filter((c) => !assignedIds.has(c.user.id))

  const add = useMutation({
    mutationFn: async () => {
      await api.post(`/projects/${projectId}/members`, {
        userId: selected,
        role: 'CLIENT_STAKEHOLDER',
      })
    },
    onSuccess: () => {
      setAdding(false)
      setSelected('')
      onChanged()
    },
    onError: (err) => onError(err, 'Failed to add stakeholder.'),
  })

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/projects/${projectId}/members/${userId}`)
    },
    onSuccess: onChanged,
    onError: (err) => onError(err, 'Failed to remove stakeholder.'),
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Client stakeholders
        </p>
        {canManage && !adding && (
          <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3 w-3" /> Add
          </Button>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Client users only see projects they are added to here. Client admins see all their
        company’s projects automatically.
      </p>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No client stakeholders added.</p>
      ) : (
        <ul className="space-y-1">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-md border border-border bg-muted/10 px-3 py-1.5"
            >
              <span className="text-sm text-foreground">{displayName(m.user)}</span>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(m.userId)}
                  disabled={remove.isPending}
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && canManage && (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select a client user…</option>
            {candidates.map((c) => (
              <option key={c.user.id} value={c.user.id}>
                {displayName(c.user)}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => add.mutate()} disabled={!selected || add.isPending}>
            {add.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
