import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'KYC Review' }

export default function AdminKYCPage() {
  return (
    <ComingSoon
      title="KYC Review Queue"
      description="Review pending identity verification submissions."
    />
  )
}
