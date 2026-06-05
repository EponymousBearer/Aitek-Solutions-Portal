import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Agreements' }

export default function PortalAgreementsPage() {
  return (
    <ComingSoon
      title="Agreements"
      description="Review and acknowledge agreements and NDAs, with a full audit trail."
    />
  )
}
