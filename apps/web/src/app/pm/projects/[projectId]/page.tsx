'use client'

import { useParams } from 'next/navigation'

import { InternalProjectDetail } from '@/components/projects/internal-project-detail'

export default function PmProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  return <InternalProjectDetail projectId={params.projectId} backHref="/pm" canEdit />
}
