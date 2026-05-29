'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import { OnboardingPhase } from '@aitek/types'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'

import { OnboardingSummary } from '@/components/onboarding/onboarding-summary'
import { Button } from '@/components/ui/button'
import { useOnboardingPhaseGuard } from '@/hooks/useOnboardingProgress'
import { api } from '@/lib/api'
import { routeForPhase } from '@/lib/onboarding'

export default function ReviewPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { ready } = useOnboardingPhaseGuard(OnboardingPhase.REVIEW)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEdit = (phase: OnboardingPhase) => {
    router.push(`${routeForPhase(phase)}?return=review`)
  }

  const handleFinalize = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/onboarding/finalize')
      await queryClient.invalidateQueries({ queryKey: ['current-user'] })
      await queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] })
      router.push('/onboarding/pending')
    } catch (err) {
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message
          ? (err as { response: { data: { message: string } } }).response.data.message
          : 'Failed to submit. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground">One last look</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Review everything below and edit any section if needed. Once you submit for review you
            won&apos;t be able to make changes.
          </p>
        </div>
      </div>

      <OnboardingSummary onEdit={handleEdit} />

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {!confirming ? (
        <div className="flex justify-end">
          <Button onClick={() => setConfirming(true)}>Submit for review</Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This locks your submission — you won&apos;t be able to edit any section afterwards.
              Submit for review?
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleFinalize} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? 'Submitting…' : 'Yes, submit for review'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
