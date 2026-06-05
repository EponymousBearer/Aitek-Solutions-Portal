import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Settings' }

export default function PortalSettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      description="Manage your profile, company details, and notification preferences."
    />
  )
}
