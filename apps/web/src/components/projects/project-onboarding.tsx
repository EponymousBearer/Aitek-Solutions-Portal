'use client'

import type { KYCDocumentCategory } from '@aitek/types'

import {
  OnboardingSummaryView,
  type SummaryAnswer,
  type SummaryCustomRequest,
  type SummaryDoc,
} from '@/components/onboarding/onboarding-summary'

// The onboarding bundle the projects API nests under `project.company`.
export interface ProjectCompany {
  name: string
  industry: string | null
  businessType: string | null
  employeeCount: string | null
  country: string | null
  state: string | null
  website: string | null
  annualRevenueRange: string | null
  yearsInBusiness: string | null
  selectedServices: { id: string; service: { id: string; name: string } }[]
  kycSubmissions: {
    id: string
    documents: {
      id: string
      category: KYCDocumentCategory
      fileName: string
      fileSize: number
      status: string
    }[]
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
}

// Read-only render of everything a company submitted during onboarding, derived
// from a project's nested company bundle. Reused on the client + admin project
// detail pages.
export function ProjectOnboarding({ company }: { company: ProjectCompany }) {
  const documents: SummaryDoc[] = company.kycSubmissions[0]?.documents ?? []
  const services = company.selectedServices.map((s) => ({ id: s.service.id, name: s.service.name }))
  const answers: SummaryAnswer[] = (company.onboardingSessions[0]?.responses ?? [])
    .flatMap((r) => r.answers)
    .map((a) => ({ questionId: a.questionId, questionText: a.question.text, value: a.jsonValue }))
  const cr = company.customRequests[0]
  const customRequest: SummaryCustomRequest | null = cr
    ? {
        description: cr.description,
        goals: cr.goals,
        budget: cr.budget,
        timeline: cr.timeline,
        fileKeys: cr.fileKeys,
        status: cr.status,
      }
    : null

  return (
    <OnboardingSummaryView
      company={company}
      documents={documents}
      services={services}
      answers={answers}
      customRequest={customRequest}
    />
  )
}
