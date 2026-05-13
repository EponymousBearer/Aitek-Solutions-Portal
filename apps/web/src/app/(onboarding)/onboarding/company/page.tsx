import type { Metadata } from 'next'

import { ComingSoon } from '@/components/shared/coming-soon'

export const metadata: Metadata = { title: 'Company Setup' }

export default function CompanyPage() {
  return (
    <ComingSoon
      title="Company Information"
      description="Tell us about your company so we can tailor the experience to your needs."
    />
  )
}
