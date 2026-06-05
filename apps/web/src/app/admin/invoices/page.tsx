import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Invoices' }

export default function AdminInvoicesPage() {
  return (
    <ComingSoon
      title="Invoices"
      description="Create and manage client invoices, and track their status."
    />
  )
}
