import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Messages' }

export default function PortalMessagesPage() {
  return (
    <ComingSoon
      title="Messages"
      description="Real-time messaging with your AiTek team, scoped to each project."
    />
  )
}
