'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { useAuth } from '@clerk/nextjs'

import { useCurrentUser } from '@/hooks/useCurrentUser'

// Onboarding is a client-only flow. Aitek team (admin / team member) have no
// company to onboard, so a freshly signed-up admin who lands here (sign-up
// forces /onboarding/company) gets bounced to the admin panel. Mirrors the
// Aitek branch in PortalGuard.
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user, isLoading, isAitekTeam } = useCurrentUser()
  const router = useRouter()

  const ready = isLoaded && (isSignedIn === false || (!isLoading && user !== undefined))
  const redirectToAdmin = ready && isAitekTeam

  useEffect(() => {
    if (redirectToAdmin) router.replace('/admin')
  }, [redirectToAdmin, router])

  if (!ready || redirectToAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
