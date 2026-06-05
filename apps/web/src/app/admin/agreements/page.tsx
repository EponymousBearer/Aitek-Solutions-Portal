import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Agreements' }

export default function AdminAgreementsPage() {
  return (
    <ComingSoon
      title="Agreements"
      description="Create agreements, send them for client acknowledgment, and view the audit trail."
    />
  )
}
