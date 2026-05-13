import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Projects' }

export default function ProjectsPage() {
  return <ComingSoon title="Your Projects" description="All your active and completed projects." />
}
