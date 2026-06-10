'use client'

import { AgreementsPanel } from '@/components/agreements/agreements-panel'

export default function AdminAgreementsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agreements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every agreement across clients and their signing status. Create new ones from a project.
        </p>
      </div>
      <AgreementsPanel heading="All agreements" showProject />
    </div>
  )
}
