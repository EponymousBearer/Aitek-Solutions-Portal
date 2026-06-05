'use client'

import { useState } from 'react'

import Link from 'next/link'

import { OnboardingPhase } from '@aitek/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, RotateCcw, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface PhaseStatus {
  key: OnboardingPhase
  label: string
  status: 'done' | 'current' | 'locked'
}

interface OnboardingClient {
  id: string
  name: string
  industry: string | null
  country: string | null
  state: string | null
  website: string | null
  kycStatus: string
  onboardingPhase: OnboardingPhase
  portalAccessGranted: boolean
  submittedForReviewAt: string | null
  createdAt: string
  memberships: { user: { id: string; email: string; firstName: string; lastName: string } }[]
  _count: { selectedServices: number }
  progress: { phase: OnboardingPhase; percent: number; phases: PhaseStatus[] }
}

const PHASE_LABELS: Record<OnboardingPhase, string> = {
  [OnboardingPhase.COMPANY]: 'Company',
  [OnboardingPhase.KYC]: 'Identity',
  [OnboardingPhase.SERVICES]: 'Services',
  [OnboardingPhase.QUESTIONNAIRE]: 'Requirements',
  [OnboardingPhase.REVIEW]: 'Review',
  [OnboardingPhase.SUBMITTED]: 'Submitted',
}

// Phases an admin can re-open for changes.
const REOPENABLE: OnboardingPhase[] = [
  OnboardingPhase.COMPANY,
  OnboardingPhase.KYC,
  OnboardingPhase.SERVICES,
  OnboardingPhase.QUESTIONNAIRE,
]

function extractMessage(err: unknown, fallback: string): string {
  return typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
    ? (err as { response: { data: { message: string } } }).response.data.message
    : fallback
}

function ProgressCell({ progress }: { progress: OnboardingClient['progress'] }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{progress.percent}%</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {progress.phases.map((p) => (
          <span
            key={p.key}
            title={`${p.label}: ${p.status}`}
            className={`inline-flex h-1.5 w-6 rounded-full ${
              p.status === 'done'
                ? 'bg-primary'
                : p.status === 'current'
                  ? 'bg-primary/40'
                  : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default function AdminClientsPage() {
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reopenFor, setReopenFor] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<OnboardingClient[]>({
    queryKey: ['admin-onboarding-clients'],
    queryFn: async () =>
      (await api.get<{ data: OnboardingClient[] }>('/companies/onboarding')).data.data,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-onboarding-clients'] })

  const approveMutation = useMutation({
    mutationFn: async (companyId: string) => {
      setBusyId(companyId)
      setErrorMessage(null)
      try {
        await api.post(`/companies/${companyId}/approve`)
      } finally {
        setBusyId(null)
      }
    },
    onSuccess: () => void invalidate(),
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to approve.')),
  })

  const reopenMutation = useMutation({
    mutationFn: async ({ companyId, phase }: { companyId: string; phase: OnboardingPhase }) => {
      setBusyId(companyId)
      setErrorMessage(null)
      try {
        await api.post(`/companies/${companyId}/reopen`, { phase })
      } finally {
        setBusyId(null)
        setReopenFor(null)
      }
    },
    onSuccess: () => void invalidate(),
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to request changes.')),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Client onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every client and how far they&apos;ve gotten. Approve once a client has submitted for
          review, or request changes to send a section back for edits.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Failed to load clients.
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No clients yet</p>
          <p className="text-xs text-muted-foreground">
            Clients appear here as soon as they start onboarding.
          </p>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Primary contact</th>
                <th className="px-4 py-2.5">Progress</th>
                <th className="px-4 py-2.5">Phase</th>
                <th className="px-4 py-2.5">KYC</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => {
                const contact = c.memberships[0]?.user
                const isBusy = busyId === c.id
                const isSubmitted = c.onboardingPhase === OnboardingPhase.SUBMITTED
                return (
                  <tr key={c.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/clients/${c.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {[c.state, c.country].filter(Boolean).join(', ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {contact ? (
                        <>
                          <div className="text-foreground">
                            {contact.firstName} {contact.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">{contact.email}</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ProgressCell progress={c.progress} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {PHASE_LABELS[c.onboardingPhase] ?? c.onboardingPhase}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {c.kycStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.portalAccessGranted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                        </span>
                      ) : (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReopenFor(reopenFor === c.id ? null : c.id)}
                              disabled={isBusy}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" /> Request changes
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate(c.id)}
                              disabled={isBusy || !isSubmitted}
                              title={isSubmitted ? undefined : 'Client has not submitted yet'}
                            >
                              {isBusy ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                              )}
                              Approve
                            </Button>
                          </div>
                          {reopenFor === c.id && (
                            <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-md border border-border bg-muted/40 p-2">
                              <span className="text-xs text-muted-foreground">Reopen:</span>
                              {REOPENABLE.map((phase) => (
                                <Button
                                  key={phase}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  disabled={isBusy}
                                  onClick={() => reopenMutation.mutate({ companyId: c.id, phase })}
                                >
                                  {PHASE_LABELS[phase]}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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
