'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { useAuth } from '@clerk/nextjs'

import { useCurrentUser } from '@/hooks/useCurrentUser'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user, isLoading, isAitekTeam } = useCurrentUser()
  const router = useRouter()

  const ready = isLoaded && (isSignedIn === false || (!isLoading && user !== undefined))

  useEffect(() => {
    if (!ready) return
    if (!isSignedIn) {
      router.replace('/sign-in')
      return
    }
    if (!isAitekTeam) {
      router.replace('/portal')
    }
  }, [ready, isSignedIn, isAitekTeam, router])

  if (!ready || !isAitekTeam) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
