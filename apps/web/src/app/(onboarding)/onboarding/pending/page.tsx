'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import type { KYCStatus } from '@aitek/types'
import { KYCDocumentCategory } from '@aitek/types'
import { useClerk } from '@clerk/nextjs'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, FileText, LogOut, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api } from '@/lib/api'

interface CompanyInfo {
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
}

interface KycDoc {
  id: string
  category: KYCDocumentCategory
  fileName: string
  fileSize: number
}

interface KycSubmission {
  id: string
  status: KYCStatus
  documents: KycDoc[]
}

interface SelectedService {
  id: string
  name: string
  slug: string
}

interface ResponseAnswer {
  questionId: string
  jsonValue: unknown
  question: { id: string; text: string }
}

interface OnboardingSession {
  id: string
  status: string
  responses: Array<{
    id: string
    template: { id: string; name: string }
    answers: ResponseAnswer[]
  }>
}

const KYC_LABELS: Record<KYCDocumentCategory, string> = {
  [KYCDocumentCategory.BUSINESS_REGISTRATION]: 'Business registration',
  [KYCDocumentCategory.TAX_ID]: 'Tax ID / EIN / GST',
  [KYCDocumentCategory.GOVERNMENT_ID]: 'Government ID',
  [KYCDocumentCategory.ADDRESS_PROOF]: 'Proof of address',
  [KYCDocumentCategory.NDA]: 'NDA',
  [KYCDocumentCategory.OTHER]: 'Other',
}

function formatAnswer(value: unknown): string {
  if (value == null) return '—'
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

export default function PendingPage() {
  const router = useRouter()
  const { signOut } = useClerk()
  const { user, isLoading: userLoading } = useCurrentUser()

  // Once admin approves, portalAccessGranted flips true. Bounce them.
  useEffect(() => {
    if (!userLoading && user?.portalAccessGranted) {
      router.replace('/portal')
    }
  }, [userLoading, user?.portalAccessGranted, router])

  const { data: company } = useQuery<CompanyInfo | null>({
    queryKey: ['my-company'],
    queryFn: async () => {
      try {
        return (await api.get<{ data: CompanyInfo }>('/companies/me')).data.data
      } catch {
        return null
      }
    },
  })

  const { data: kyc } = useQuery<KycSubmission | null>({
    queryKey: ['kyc-me'],
    queryFn: async () =>
      (await api.get<{ data: KycSubmission | null }>('/kyc/me')).data.data,
  })

  const { data: services } = useQuery<SelectedService[]>({
    queryKey: ['my-services'],
    queryFn: async () =>
      (await api.get<{ data: SelectedService[] }>('/onboarding/services')).data.data,
  })

  const { data: session } = useQuery<OnboardingSession | null>({
    queryKey: ['onboarding-session'],
    queryFn: async () =>
      (await api.get<{ data: OnboardingSession | null }>('/onboarding/sessions/me')).data.data,
  })

  const response = session?.responses?.[0]
  const isApproved = user?.portalAccessGranted === true

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* Account actions — let waiting users sign out */}
      <div className="flex items-center justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => void signOut(() => router.push('/sign-in'))}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>

      {/* Status banner */}
      <div
        className={`flex items-start gap-3 rounded-xl border p-4 ${
          isApproved
            ? 'border-green-200 bg-green-50'
            : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isApproved ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-foreground">
            {isApproved ? 'Approved — welcome aboard' : 'Under review'}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isApproved
              ? 'Your portal is open. Redirecting…'
              : 'Thanks — we got everything. Our team is reviewing your submission and will email you the moment your portal is ready.'}
          </p>
          {!isApproved && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              Notification will be sent to {user?.email ?? 'your email on file'}
            </p>
          )}
        </div>
      </div>

      {/* Summary header */}
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Submitted onboarding
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Here&apos;s what we received. If anything needs to change, contact your AiTek
          representative.
        </p>
      </div>

      {/* Company */}
      <section className="space-y-2 rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold text-foreground">Company</h3>
        {company ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <SummaryRow label="Name" value={company.name} />
            <SummaryRow label="Industry" value={company.industry} />
            <SummaryRow label="Business type" value={company.businessType} />
            <SummaryRow label="Team size" value={company.employeeCount} />
            <SummaryRow
              label="Location"
              value={[company.state, company.country].filter(Boolean).join(', ') || null}
            />
            <SummaryRow label="Website" value={company.website} />
            <SummaryRow label="Annual revenue" value={company.annualRevenueRange} />
            <SummaryRow label="Years in business" value={company.yearsInBusiness} />
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">No company on file.</p>
        )}
      </section>

      {/* KYC */}
      <section className="space-y-2 rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold text-foreground">Identity verification</h3>
        {kyc?.documents?.length ? (
          <ul className="space-y-1.5">
            {kyc.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 text-sm text-foreground"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {KYC_LABELS[doc.category] ?? doc.category}
                </span>
                <span className="truncate text-xs text-muted-foreground">{doc.fileName}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No documents uploaded.</p>
        )}
      </section>

      {/* Service */}
      <section className="space-y-2 rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold text-foreground">Service interest</h3>
        {services && services.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <li
                key={s.id}
                className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {s.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No service selected.</p>
        )}
      </section>

      {/* Questionnaire */}
      <section className="space-y-2 rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold text-foreground">Project requirements</h3>
        {response?.answers && response.answers.length > 0 ? (
          <dl className="space-y-3 text-sm">
            {response.answers.map((a) => (
              <div key={a.questionId}>
                <dt className="text-xs font-medium text-muted-foreground">{a.question.text}</dt>
                <dd className="mt-0.5 text-foreground">{formatAnswer(a.jsonValue)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">No responses recorded.</p>
        )}
      </section>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || '—'}</dd>
    </>
  )
}
