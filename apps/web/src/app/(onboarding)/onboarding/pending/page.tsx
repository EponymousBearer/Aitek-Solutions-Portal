'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { OnboardingPhase } from '@aitek/types'
import { useClerk } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Loader2, LogOut, Mail } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useOnboardingPhaseGuard } from '@/hooks/useOnboardingProgress'

export default function PendingPage() {
  const router = useRouter()
  const { signOut } = useClerk()
  const queryClient = useQueryClient()
  const { user, isLoading: userLoading } = useCurrentUser()
  // SUBMITTED is the only phase that belongs here. If an admin reopened a phase,
  // the pointer regresses and the guard bounces the client to that phase.
  const { ready } = useOnboardingPhaseGuard(OnboardingPhase.SUBMITTED)

  const isApproved = user?.portalAccessGranted === true

  // Once admin approves, portalAccessGranted flips true. Bounce them.
  useEffect(() => {
    if (!userLoading && isApproved) {
      router.replace('/portal')
    }
  }, [userLoading, isApproved, router])

  if (!ready) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* Account actions — let waiting users sign out */}
      <div className="flex items-center justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => {
            queryClient.clear()
            void signOut(() => router.push('/sign-in'))
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>

      {/* Status banner — no details, just the review state */}
      <div
        className={`flex items-start gap-3 rounded-xl border p-4 ${
          isApproved ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isApproved ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-foreground">
            {isApproved ? 'Approved — welcome aboard' : 'Under review'}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isApproved
              ? 'Your portal is open. Redirecting…'
              : 'Thanks — we got everything. Our team is reviewing your submission and will email you the moment your portal is ready.'}
          </p>
          {!isApproved && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              Notification will be sent to {user?.email ?? 'your email on file'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
