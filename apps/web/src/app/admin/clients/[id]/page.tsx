'use client'

import { useState } from 'react'

import Link from 'next/link'
import { useParams } from 'next/navigation'

import { type KYCDocumentCategory, OnboardingPhase } from '@aitek/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw } from 'lucide-react'

import {
  OnboardingSummaryView,
  type SummaryAnswer,
  type SummaryCustomRequest,
  type SummaryDoc,
} from '@/components/onboarding/onboarding-summary'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface PhaseStatus {
  key: OnboardingPhase
  label: string
  status: 'done' | 'current' | 'locked'
}

interface CompanyDetail {
  id: string
  name: string
  industry: string | null
  businessType: string | null
  employeeCount: string | null
  country: string | null
  state: string | null
  website: string | null
  annualRevenueRange: string | null
  yearsInBusiness: string | null
  kycStatus: string
  onboardingPhase: OnboardingPhase
  portalAccessGranted: boolean
  submittedForReviewAt: string | null
  createdAt: string
  memberships: {
    role: string
    user: { id: string; email: string; firstName: string; lastName: string; role: string }
  }[]
  selectedServices: { id: string; service: { id: string; name: string; slug: string } }[]
  kycSubmissions: {
    id: string
    status: string
    documents: { id: string; category: KYCDocumentCategory; fileName: string; fileSize: number; status: string }[]
  }[]
  onboardingSessions: {
    id: string
    responses: {
      id: string
      answers: { questionId: string; jsonValue: unknown; question: { id: string; text: string } }[]
    }[]
  }[]
  customRequests: {
    id: string
    description: string
    goals: string | null
    budget: string | null
    timeline: string | null
    fileKeys: string[]
    status: string
  }[]
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

export default function AdminClientDetailPage() {
  const params = useParams<{ id: string }>()
  const companyId = params.id
  const queryClient = useQueryClient()
  const [reopenOpen, setReopenOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<CompanyDetail>({
    queryKey: ['admin-client-detail', companyId],
    queryFn: async () =>
      (await api.get<{ data: CompanyDetail }>(`/companies/${companyId}/detail`)).data.data,
    enabled: !!companyId,
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-client-detail', companyId] })
    await queryClient.invalidateQueries({ queryKey: ['admin-onboarding-clients'] })
  }

  const approveMutation = useMutation({
    mutationFn: async () => {
      setActionError(null)
      await api.post(`/companies/${companyId}/approve`)
    },
    onSuccess: () => void invalidate(),
    onError: (err) => setActionError(extractMessage(err, 'Failed to approve.')),
  })

  const reopenMutation = useMutation({
    mutationFn: async (phase: OnboardingPhase) => {
      setActionError(null)
      await api.post(`/companies/${companyId}/reopen`, { phase })
    },
    onSuccess: () => {
      setReopenOpen(false)
      void invalidate()
    },
    onError: (err) => setActionError(extractMessage(err, 'Failed to request changes.')),
  })

  const busy = approveMutation.isPending || reopenMutation.isPending

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
        <Link href="/admin/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to clients
        </Link>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Failed to load this client.
        </div>
      </div>
    )
  }

  const contact = data.memberships.find((m) => m.role === 'CLIENT_ADMIN')?.user ?? data.memberships[0]?.user
  const documents: SummaryDoc[] = data.kycSubmissions[0]?.documents ?? []
  const services = data.selectedServices.map((s) => ({ id: s.service.id, name: s.service.name }))
  const answers: SummaryAnswer[] = (data.onboardingSessions[0]?.responses ?? [])
    .flatMap((r) => r.answers)
    .map((a) => ({ questionId: a.questionId, questionText: a.question.text, value: a.jsonValue }))
  const customRequest: SummaryCustomRequest | null = data.customRequests[0]
    ? {
        description: data.customRequests[0].description,
        goals: data.customRequests[0].goals,
        budget: data.customRequests[0].budget,
        timeline: data.customRequests[0].timeline,
        fileKeys: data.customRequests[0].fileKeys,
        status: data.customRequests[0].status,
      }
    : null
  const isSubmitted = data.onboardingPhase === OnboardingPhase.SUBMITTED

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to clients
      </Link>

      {/* Header */}
      <div className="space-y-4 rounded-xl border border-border bg-background p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">{data.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[data.state, data.country].filter(Boolean).join(', ') || '—'}
            </p>
            {contact && (
              <p className="mt-1 text-sm text-foreground">
                {contact.firstName} {contact.lastName}{' '}
                <span className="text-muted-foreground">· {contact.email}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {PHASE_LABELS[data.onboardingPhase] ?? data.onboardingPhase}
            </span>
            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              KYC: {data.kycStatus}
            </span>
            {data.portalAccessGranted && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approved
              </span>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${data.progress.percent}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{data.progress.percent}%</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.progress.phases.map((p) => (
              <span
                key={p.key}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                  p.status === 'done'
                    ? 'bg-primary/10 text-primary'
                    : p.status === 'current'
                      ? 'bg-primary/5 text-primary ring-1 ring-primary/30'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {actionError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {actionError}
          </div>
        )}

        {/* Actions */}
        {!data.portalAccessGranted && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReopenOpen((o) => !o)}
                disabled={busy}
              >
                <RotateCcw className="mr-1 h-3 w-3" /> Request changes
              </Button>
              <Button
                size="sm"
                onClick={() => approveMutation.mutate()}
                disabled={busy || !isSubmitted}
                title={isSubmitted ? undefined : 'Client has not submitted for review yet'}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                )}
                Approve
              </Button>
            </div>
            {reopenOpen && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/40 p-2">
                <span className="text-xs text-muted-foreground">Reopen phase:</span>
                {REOPENABLE.map((phase) => (
                  <Button
                    key={phase}
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    disabled={busy}
                    onClick={() => reopenMutation.mutate(phase)}
                  >
                    {PHASE_LABELS[phase]}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full submitted detail */}
      <OnboardingSummaryView
        company={data}
        documents={documents}
        services={services}
        answers={answers}
        customRequest={customRequest}
      />
    </div>
  )
}
