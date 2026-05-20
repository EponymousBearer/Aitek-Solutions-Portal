export const dynamic = 'force-dynamic'

import { OnboardingHeader } from '@/components/shared/onboarding-header'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OnboardingHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">{children}</main>
    </div>
  )
}
