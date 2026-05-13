import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Requirements Questionnaire' }

export default function QuestionnairePage() {
  return (
    <ComingSoon
      title="AI-Assisted Questionnaire"
      description="Our intelligent assistant will guide you through understanding your requirements."
    />
  )
}
