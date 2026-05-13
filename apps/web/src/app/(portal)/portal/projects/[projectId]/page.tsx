import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Project' }

interface PageProps {
  params: { projectId: string }
}

export default function ProjectDetailPage({ params }: PageProps) {
  return (
    <ComingSoon
      title={`Project ${params.projectId}`}
      description="Project overview, milestones, documents, and messages."
    />
  )
}
