import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Services' }

export default function AdminServicesPage() {
  return (
    <ComingSoon
      title="Service Catalog"
      description="Manage the services and categories shown to clients during onboarding."
    />
  )
}
