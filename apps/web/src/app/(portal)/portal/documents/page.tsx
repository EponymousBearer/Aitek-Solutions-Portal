import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Documents' }

export default function PortalDocumentsPage() {
  return (
    <ComingSoon
      title="Documents"
      description="Your contracts, deliverables, and shared files will live here."
    />
  )
}
