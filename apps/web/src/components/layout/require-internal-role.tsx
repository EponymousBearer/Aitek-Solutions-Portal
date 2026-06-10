'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { useAuth } from '@clerk/nextjs'

import { useCurrentUser } from '@/hooks/useCurrentUser'
import { homePathFor, userMatchesArea, type InternalArea } from '@/lib/internal-routes'

// Gates an internal shell (/admin, /pm, /dev) to a single role. Anyone signed in
// but in the wrong area is bounced to their own home; signed-out users go to
// sign-in. DB-backed (reads /auth/me), so it's correct even when the JWT role
// claim lags.
export function RequireInternalRole({
  area,
  children,
}: {
  area: InternalArea
  children: React.ReactNode
}) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user, isLoading } = useCurrentUser()
  const router = useRouter()

  const ready = isLoaded && (isSignedIn === false || (!isLoading && user !== undefined))
  const allowed = ready && isSignedIn && userMatchesArea(user, area)

  useEffect(() => {
    if (!ready) return
    if (!isSignedIn) {
      router.replace('/sign-in')
      return
    }
    if (!userMatchesArea(user, area)) {
      router.replace(homePathFor(user))
    }
  }, [ready, isSignedIn, user, area, router])

  if (!allowed) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
