import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Identity Verification' }

export default function KYCPage() {
  return (
    <ComingSoon
      title="Identity Verification"
      description="Upload the required documents to verify your business identity."
    />
  )
}
