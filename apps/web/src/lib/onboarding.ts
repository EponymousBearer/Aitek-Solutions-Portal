import { OnboardingPhase } from '@aitek/types'

// Maps the authoritative onboarding phase pointer to the page that owns it.
export const ONBOARDING_PHASE_ROUTE: Record<OnboardingPhase, string> = {
  [OnboardingPhase.COMPANY]: '/onboarding/company',
  [OnboardingPhase.KYC]: '/onboarding/kyc',
  [OnboardingPhase.SERVICES]: '/onboarding/services',
  [OnboardingPhase.QUESTIONNAIRE]: '/onboarding/questionnaire',
  [OnboardingPhase.REVIEW]: '/onboarding/review',
  [OnboardingPhase.SUBMITTED]: '/onboarding/pending',
}

export function routeForPhase(phase?: OnboardingPhase): string {
  return (phase && ONBOARDING_PHASE_ROUTE[phase]) || '/onboarding/company'
}
