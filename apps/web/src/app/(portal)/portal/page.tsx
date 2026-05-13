import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Dashboard' }

export default function PortalDashboardPage() {
  return (
    <ComingSoon
      title="Client Dashboard"
      description="Your active projects, pending actions, and recent activity will appear here."
    />
  )
}
