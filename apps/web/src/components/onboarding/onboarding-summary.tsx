'use client'

import type { KYCStatus } from '@aitek/types'
import { KYCDocumentCategory, OnboardingPhase } from '@aitek/types'
import { useQuery } from '@tanstack/react-query'
import { FileText, Paperclip, Pencil, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

// ─── Normalized shapes the presentational view renders ──────────────────────

export interface SummaryCompany {
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

export interface SummaryDoc {
  id: string
  category: KYCDocumentCategory
  fileName: string
  fileSize: number
  status?: string
}

export interface SummaryService {
  id: string
  name: string
}

export interface SummaryAnswer {
  questionId: string
  questionText: string
  value: unknown
}

export interface SummaryCustomRequest {
  description: string
  goals: string | null
  budget: string | null
  timeline: string | null
  fileKeys: string[]
  status?: string
}

const KYC_LABELS: Record<KYCDocumentCategory, string> = {
  [KYCDocumentCategory.BUSINESS_REGISTRATION]: 'Business registration',
  [KYCDocumentCategory.TAX_ID]: 'Tax ID / EIN / GST',
  [KYCDocumentCategory.GOVERNMENT_ID]: 'Government ID',
  [KYCDocumentCategory.ADDRESS_PROOF]: 'Proof of address',
  [KYCDocumentCategory.NDA]: 'NDA',
  [KYCDocumentCategory.OTHER]: 'Other',
}

export function kycCategoryLabel(category: KYCDocumentCategory): string {
  return KYC_LABELS[category] ?? category
}

function formatAnswer(value: unknown): string {
  if (value == null) return '—'
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value || '—'}</dd>
    </>
  )
}

function SectionHeader({
  title,
  phase,
  onEdit,
  onEditAction,
}: {
  title: string
  phase?: OnboardingPhase
  onEdit?: (phase: OnboardingPhase) => void
  onEditAction?: () => void
}) {
  const handler = onEditAction ?? (phase && onEdit ? () => onEdit(phase) : undefined)
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {handler && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handler}>
          <Pencil className="mr-1 h-3 w-3" /> Edit
        </Button>
      )}
    </div>
  )
}

// ─── Presentational view (data-driven; no fetching) ─────────────────────────

export function OnboardingSummaryView({
  company,
  documents,
  services,
  answers,
  customRequest,
  onEdit,
  onEditCustomRequest,
}: {
  company: SummaryCompany | null
  documents: SummaryDoc[]
  services: SummaryService[]
  answers: SummaryAnswer[]
  customRequest?: SummaryCustomRequest | null
  onEdit?: (phase: OnboardingPhase) => void
  onEditCustomRequest?: () => void
}) {
  // A custom "Something else" request stands in for service selection + the
  // questionnaire, so we render it instead of those two sections.
  const isCustom = !!customRequest

  return (
    <div className="space-y-4">
      {/* Company */}
      <section className="space-y-2 rounded-lg border border-border bg-background p-4">
        <SectionHeader title="Company" phase={OnboardingPhase.COMPANY} onEdit={onEdit} />
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
        <SectionHeader title="Identity verification" phase={OnboardingPhase.KYC} onEdit={onEdit} />
        {documents.length > 0 ? (
          <ul className="space-y-1.5">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 text-sm text-foreground"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  {kycCategoryLabel(doc.category)}
                </span>
                <span className="truncate text-xs text-muted-foreground">{doc.fileName}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No documents uploaded.</p>
        )}
      </section>

      {isCustom ? (
        /* Custom "Something else" request */
        <section className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <SectionHeader
            title="Custom request"
            onEditAction={onEditCustomRequest}
          />
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Something else
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">What they&apos;re looking for</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-foreground">
                {customRequest!.description || '—'}
              </dd>
            </div>
            {customRequest!.goals && (
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Goals</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-foreground">{customRequest!.goals}</dd>
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-4">
              <SummaryRow label="Budget" value={customRequest!.budget} />
              <SummaryRow label="Timeline" value={customRequest!.timeline} />
            </div>
          </dl>
          {customRequest!.fileKeys.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {customRequest!.fileKeys.map((name) => (
                <li
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-xs text-foreground"
                >
                  <Paperclip className="h-3 w-3 text-muted-foreground" /> {name}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          {/* Services */}
          <section className="space-y-2 rounded-lg border border-border bg-background p-4">
            <SectionHeader
              title="Service interest"
              phase={OnboardingPhase.SERVICES}
              onEdit={onEdit}
            />
            {services.length > 0 ? (
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
            <SectionHeader
              title="Project requirements"
              phase={OnboardingPhase.QUESTIONNAIRE}
              onEdit={onEdit}
            />
            {answers.length > 0 ? (
              <dl className="space-y-3 text-sm">
                {answers.map((a) => (
                  <div key={a.questionId}>
                    <dt className="text-xs font-medium text-muted-foreground">{a.questionText}</dt>
                    <dd className="mt-0.5 text-foreground">{formatAnswer(a.value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">No responses recorded.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}

// ─── Self-scoped wrapper (used by the client Review step) ────────────────────

interface CompanyInfo extends SummaryCompany {
  id: string
}
interface KycSubmission {
  id: string
  status: KYCStatus
  documents: SummaryDoc[]
}
interface SelectedService {
  id: string
  name: string
  slug: string
}
interface OnboardingSession {
  id: string
  responses: Array<{
    id: string
    answers: Array<{ questionId: string; jsonValue: unknown; question: { id: string; text: string } }>
  }>
}

export function OnboardingSummary({
  onEdit,
  onEditCustomRequest,
}: {
  onEdit?: (phase: OnboardingPhase) => void
  onEditCustomRequest?: () => void
}) {
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
    queryFn: async () => (await api.get<{ data: KycSubmission | null }>('/kyc/me')).data.data,
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

  const { data: customRequest } = useQuery<SummaryCustomRequest | null>({
    queryKey: ['custom-request-me'],
    queryFn: async () =>
      (await api.get<{ data: SummaryCustomRequest | null }>('/custom-requests/me')).data.data,
  })

  // Flatten answers across every response (one per selected service template).
  const answers: SummaryAnswer[] = (session?.responses ?? [])
    .flatMap((r) => r.answers)
    .map((a) => ({ questionId: a.questionId, questionText: a.question.text, value: a.jsonValue }))

  return (
    <OnboardingSummaryView
      company={company ?? null}
      documents={kyc?.documents ?? []}
      services={services ?? []}
      answers={answers}
      customRequest={customRequest ?? null}
      onEdit={onEdit}
      onEditCustomRequest={onEditCustomRequest}
    />
  )
}
