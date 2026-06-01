'use client'

import { useEffect } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import { OnboardingPhase } from '@aitek/types'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { routeForPhase } from '@/lib/onboarding'

export interface PhaseStatus {
  key: OnboardingPhase
  label: string
  status: 'done' | 'current' | 'locked'
}

export interface OnboardingProgress {
  phase: OnboardingPhase
  percent: number
  phases: PhaseStatus[]
}

export function useOnboardingProgress() {
  return useQuery<OnboardingProgress>({
    queryKey: ['onboarding-progress'],
    queryFn: async () =>
      (await api.get<{ data: OnboardingProgress }>('/onboarding/progress')).data.data,
  })
}

// Per-phase gate for onboarding pages. A page may be shown only when it is the
// client's current phase — or when entered from the Review step (`?return=review`),
// which re-opens every phase for one final edit. Otherwise the client is bounced
// to whatever phase they actually belong on (enforces "no going back" + resume).
export function useOnboardingPhaseGuard(phase: OnboardingPhase) {
  const router = useRouter()
  const search = useSearchParams()
  const reviewMode = search.get('return') === 'review'
  const { data: progress, isLoading } = useOnboardingProgress()

  const allowed =
    !!progress &&
    (progress.phase === phase ||
      (reviewMode && progress.phase === OnboardingPhase.REVIEW))

  const target = progress && !allowed ? routeForPhase(progress.phase) : null

  useEffect(() => {
    if (target) router.replace(target)
  }, [target, router])

  return { ready: !isLoading && allowed, reviewMode, progress }
}
