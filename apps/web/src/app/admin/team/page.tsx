'use client'

import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Loader2, Plus, UserCog } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

type AitekRole = 'PROJECT_MANAGER' | 'DEVELOPER'

interface TeamMember {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'AITEK_ADMIN' | 'AITEK_TEAM_MEMBER'
  aitekRole: AitekRole | null
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  AITEK_ADMIN: 'Admin',
  PROJECT_MANAGER: 'Project Manager',
  DEVELOPER: 'Developer',
}

function roleLabel(m: TeamMember): string {
  if (m.role === 'AITEK_ADMIN') return ROLE_LABELS.AITEK_ADMIN ?? 'Admin'
  return (m.aitekRole ? ROLE_LABELS[m.aitekRole] : undefined) ?? 'Team Member'
}

function roleBadgeClass(m: TeamMember): string {
  if (m.role === 'AITEK_ADMIN') return 'bg-purple-100 text-purple-700'
  if (m.aitekRole === 'PROJECT_MANAGER') return 'bg-blue-100 text-blue-700'
  return 'bg-emerald-100 text-emerald-700'
}

function extractMessage(err: unknown, fallback: string): string {
  return typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
    ? (err as { response: { data: { message: string } } }).response.data.message
    : fallback
}

export default function AdminTeamPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [aitekRole, setAitekRole] = useState<AitekRole>('DEVELOPER')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<TeamMember[]>({
    queryKey: ['admin-team'],
    queryFn: async () => (await api.get<{ data: TeamMember[] }>('/team')).data.data,
  })

  const inviteMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null)
      setInviteUrl(null)
      setSentTo(null)
      const res = await api.post<{
        data: { sent: boolean; email: string; inviteUrl: string; status: string }
      }>('/auth/invite', { email: email.trim(), aitekRole })
      return res.data.data
    },
    onSuccess: (res) => {
      setInviteUrl(res.inviteUrl || null)
      setSentTo(res.email)
      setEmail('')
      void queryClient.invalidateQueries({ queryKey: ['admin-team'] })
    },
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to send invite.')),
  })

  const copyLink = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AiTek internal team. Invite Project Managers and Developers, then assign them to
            projects.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          <Plus className="mr-1 h-3 w-3" /> Invite member
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="person@aitek-solutions.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Role</label>
              <select
                value={aitekRole}
                onChange={(e) => setAitekRole(e.target.value as AitekRole)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="PROJECT_MANAGER">Project Manager</option>
                <option value="DEVELOPER">Developer</option>
              </select>
            </div>
          </div>

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          {sentTo && (
            <div className="space-y-1.5 rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" /> Invitation emailed to {sentTo}
              </p>
              <p className="text-xs text-emerald-700/80">
                They’ll get a link to set a password and join. The email is verified automatically.
              </p>
              {inviteUrl && (
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Fallback link (if the email doesn’t arrive — e.g. local dev or a +clerk_test
                    address):
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                      {inviteUrl}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyLink}>
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(false)
                setInviteUrl(null)
                setSentTo(null)
                setErrorMessage(null)
              }}
            >
              Done
            </Button>
            <Button
              size="sm"
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !email.trim()}
            >
              {inviteMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Send invite
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Failed to load the team.
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background py-12 text-center">
          <UserCog className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No team members yet</p>
          <p className="text-xs text-muted-foreground">Invite a Project Manager or Developer.</p>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => {
                const name = `${m.firstName} ${m.lastName}`.trim() || '—'
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-foreground">{name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass(m)}`}
                      >
                        {roleLabel(m)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
