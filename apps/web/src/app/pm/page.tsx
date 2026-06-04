'use client'

import { MyProjectsList } from '@/components/projects/my-projects-list'

export default function PmDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Projects you lead. Open one to manage its team and progress.
        </p>
      </div>
      <MyProjectsList basePath="/pm" />
    </div>
  )
}
