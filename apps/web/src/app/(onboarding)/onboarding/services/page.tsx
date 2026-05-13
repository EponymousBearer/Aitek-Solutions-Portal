import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Select Services' }

export default function ServicesPage() {
  return (
    <ComingSoon
      title="Service Selection"
      description="Choose the services you are interested in. This drives your personalised questionnaire."
    />
  )
}
