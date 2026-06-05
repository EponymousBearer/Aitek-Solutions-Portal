import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Invoices' }

export default function PortalInvoicesPage() {
  return (
    <ComingSoon
      title="Invoices"
      description="View and download your invoices and payment history."
    />
  )
}
