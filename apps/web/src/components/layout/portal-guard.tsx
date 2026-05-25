'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { KYCStatus } from '@aitek/types'
import { useAuth } from '@clerk/nextjs'

import { useCurrentUser } from '@/hooks/useCurrentUser'

// Step-aware portal gate. Decision tree (locked in planning/25 §1b):
//   1. Aitek team (admin / team member) → /admin (their home; no client portal).
//   2. No companyId → /onboarding/company
//   3. kycStatus === NOT_STARTED → /onboarding/kyc
//   4. !hasSelectedServices → /onboarding/services
//   5. !onboardingComplete → /onboarding/questionnaire
//   6. !portalAccessGranted → /onboarding/pending (KYC review pending screen)
//   7. otherwise pass through
function nextStep(user: {
  companyId?: string
  kycStatus?: KYCStatus
  hasSelectedServices?: boolean
  onboardingComplete?: boolean
  portalAccessGranted?: boolean
}): string | null {
  if (!user.companyId) return '/onboarding/company'
  if (!user.kycStatus || user.kycStatus === KYCStatus.NOT_STARTED) return '/onboarding/kyc'
  if (!user.hasSelectedServices) return '/onboarding/services'
  if (!user.onboardingComplete) return '/onboarding/questionnaire'
  if (!user.portalAccessGranted) return '/onboarding/pending'
  return null
}

export function PortalGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user, isLoading, isAitekTeam } = useCurrentUser()
  const router = useRouter()

  // Only consider a routing decision after Clerk has settled AND (we know we're
  // signed out OR the /auth/me call has returned). This blocks the static
  // layout from flashing while we figure out where to send the user.
  const ready = isLoaded && (isSignedIn === false || (!isLoading && user !== undefined))
  const target = ready && user ? (isAitekTeam ? '/admin' : nextStep(user)) : null

  useEffect(() => {
    if (target) router.replace(target)
  }, [target, router])

  if (!ready || target) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}

export { nextStep }
