'use client'

import { AgreementsPanel } from '@/components/agreements/agreements-panel'

// Project-scoped agreements card for the project detail surfaces. AiTek can
// create + send; the client reads and signs; both see the status.
export function ProjectAgreements({ projectId }: { projectId: string }) {
  return <AgreementsPanel projectId={projectId} />
}
