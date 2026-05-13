import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Admin Dashboard' }

export default function AdminDashboardPage() {
  return (
    <ComingSoon
      title="Admin Dashboard"
      description="Client overview, KYC queue, and project stats."
    />
  )
}
