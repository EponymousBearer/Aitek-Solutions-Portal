import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Clients' }

export default function AdminClientsPage() {
  return (
    <ComingSoon title="Client Management" description="Search, filter and manage all client companies." />
  )
}
