'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

import { ArrowLeft } from 'lucide-react'

import { ProjectDetailView } from '@/components/projects/project-detail-view'

export default function PortalProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/portal/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <ProjectDetailView projectId={projectId} />
    </div>
  )
}
