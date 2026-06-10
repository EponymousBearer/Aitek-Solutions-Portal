'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import type { OnboardingPhase } from '@aitek/types'
import { useAuth } from '@clerk/nextjs'

import { useCurrentUser } from '@/hooks/useCurrentUser'
import { homePathFor } from '@/lib/internal-routes'
import { routeForPhase } from '@/lib/onboarding'

// Step-aware portal gate driven by the authoritative onboarding phase pointer:
//   1. Aitek team → /admin (handled by the caller, not here).
//   2. Approved (portalAccessGranted) → pass through to the portal.
//   3. No company yet → /onboarding/company.
//   4. Otherwise → the page that owns the client's current phase
//      (REVIEW → /onboarding/review, SUBMITTED → /onboarding/pending).
function nextStep(user: {
  companyId?: string
  onboardingPhase?: OnboardingPhase
  portalAccessGranted?: boolean
}): string | null {
  if (user.portalAccessGranted) return null
  if (!user.companyId) return '/onboarding/company'
  return routeForPhase(user.onboardingPhase)
}

export function PortalGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user, isLoading, isAitekTeam } = useCurrentUser()
  const router = useRouter()

  // Only consider a routing decision after Clerk has settled AND (we know we're
  // signed out OR the /auth/me call has returned). This blocks the static
  // layout from flashing while we figure out where to send the user.
  const ready = isLoaded && (isSignedIn === false || (!isLoading && user !== undefined))
  const target = ready && user ? (isAitekTeam ? homePathFor(user) : nextStep(user)) : null

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
