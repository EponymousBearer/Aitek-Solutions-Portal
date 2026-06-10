'use client'

import { AgreementsPanel } from '@/components/agreements/agreements-panel'

export default function PortalAgreementsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agreements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and sign the agreements shared with you.
        </p>
      </div>
      <AgreementsPanel heading="Your agreements" showProject />
    </div>
  )
}
