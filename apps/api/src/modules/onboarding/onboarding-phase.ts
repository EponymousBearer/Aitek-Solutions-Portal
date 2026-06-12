import { KYCStatus, OnboardingPhase, OnboardingStatus } from '@aitek/types'
import { ConflictException } from '@nestjs/common'

import type { PrismaService } from '../../prisma/prisma.service'

// The ordered onboarding phases. A company's `onboardingPhase` pointer is the
// single source of truth for routing, locking, and the admin progress view.
export const PHASE_ORDER: OnboardingPhase[] = [
  OnboardingPhase.COMPANY,
  OnboardingPhase.KYC,
  OnboardingPhase.SERVICES,
  OnboardingPhase.QUESTIONNAIRE,
  OnboardingPhase.REVIEW,
  OnboardingPhase.SUBMITTED,
]

const REVIEW_INDEX = PHASE_ORDER.indexOf(OnboardingPhase.REVIEW)

const PHASE_LABELS: Record<OnboardingPhase, string> = {
  [OnboardingPhase.COMPANY]: 'Company',
  [OnboardingPhase.KYC]: 'Identity',
  [OnboardingPhase.SERVICES]: 'Services',
  [OnboardingPhase.QUESTIONNAIRE]: 'Requirements',
  [OnboardingPhase.REVIEW]: 'Review',
  [OnboardingPhase.SUBMITTED]: 'Submitted',
}

// The five user-facing phases shown in progress UIs (SUBMITTED is the terminal
// "100% / under review" state, not a step the client works on).
const PROGRESS_PHASES = PHASE_ORDER.slice(0, REVIEW_INDEX + 1)

// Accepts both the @aitek/types enum and the Prisma-generated enum (whose values
// are the same strings) so call sites don't have to cast Prisma reads.
export function phaseIndex(phase: OnboardingPhase | string): number {
  return PHASE_ORDER.indexOf(phase as OnboardingPhase)
}

interface CompanyPhaseRef {
  onboardingPhase: OnboardingPhase | string
}

// A phase is editable only when it IS the current phase, or when the company is
// in REVIEW (which re-opens every phase for one final edit pass).
export function isPhaseEditable(company: CompanyPhaseRef, phase: OnboardingPhase): boolean {
  return (
    company.onboardingPhase === phase || company.onboardingPhase === OnboardingPhase.REVIEW
  )
}

export function assertPhaseEditable(company: CompanyPhaseRef, phase: OnboardingPhase): void {
  if (!isPhaseEditable(company, phase)) {
    throw new ConflictException(
      'This onboarding section is locked and can no longer be edited.',
    )
  }
}

export interface PhaseStatus {
  key: OnboardingPhase
  label: string
  status: 'done' | 'current' | 'locked'
}

export interface OnboardingProgress {
  phase: OnboardingPhase
  percent: number
  phases: PhaseStatus[]
}

// Pure projection of the pointer into a checklist + overall %. SUBMITTED marks
// every phase done (100%).
export function computeProgress(company: CompanyPhaseRef): OnboardingProgress {
  const currentIdx = phaseIndex(company.onboardingPhase)
  const phases: PhaseStatus[] = PROGRESS_PHASES.map((key, i) => ({
    key,
    label: PHASE_LABELS[key],
    status: i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'locked',
  }))
  const doneCount = Math.min(currentIdx, PROGRESS_PHASES.length)
  return {
    phase: company.onboardingPhase as OnboardingPhase,
    percent: Math.round((doneCount / PROGRESS_PHASES.length) * 100),
    phases,
  }
}

// Advance the pointer forward after a phase is submitted. Fast-forwards over any
// later phases whose data is already complete (so an admin-reopened phase, once
// re-submitted, jumps straight back to REVIEW instead of re-walking the flow).
// Caps at REVIEW — SUBMITTED is reached only via explicit finalize. Monotonic:
// never moves the pointer backward.
export async function advancePhase(
  prisma: PrismaService,
  companyId: string,
  completedPhase: OnboardingPhase,
): Promise<OnboardingPhase> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { onboardingPhase: true, kycStatus: true },
  })

  const [servicesCount, completedResponse, customRequest] = await Promise.all([
    prisma.companySelectedService.count({ where: { companyId } }),
    prisma.questionnaireResponse.findFirst({
      where: { status: OnboardingStatus.COMPLETED, session: { companyId } },
      select: { id: true },
    }),
    prisma.customRequest.findFirst({ where: { companyId }, select: { id: true } }),
  ])

  // A submitted "Something else" custom request stands in for both the service
  // selection and the questionnaire — that path skips straight to REVIEW.
  const hasCustomRequest = customRequest !== null
  const kycDone =
    company.kycStatus === KYCStatus.UNDER_REVIEW || company.kycStatus === KYCStatus.APPROVED
  const servicesDone = servicesCount > 0 || hasCustomRequest
  const questionnaireDone = completedResponse !== null || hasCustomRequest

  let idx = phaseIndex(completedPhase) + 1
  while (idx < REVIEW_INDEX) {
    const p = PHASE_ORDER[idx]
    if (p === OnboardingPhase.KYC && kycDone) idx++
    else if (p === OnboardingPhase.SERVICES && servicesDone) idx++
    else if (p === OnboardingPhase.QUESTIONNAIRE && questionnaireDone) idx++
    else break
  }
  const next = PHASE_ORDER[Math.min(idx, REVIEW_INDEX)]!

  // Only move forward.
  if (phaseIndex(next) <= phaseIndex(company.onboardingPhase)) {
    return company.onboardingPhase as OnboardingPhase
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { onboardingPhase: next },
  })
  return next
}
