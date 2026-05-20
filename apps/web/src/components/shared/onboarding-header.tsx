'use client'

import { usePathname } from 'next/navigation'

const ONBOARDING_STEPS = [
  { id: 'company', label: 'Company', path: '/onboarding/company' },
  { id: 'kyc', label: 'Verification', path: '/onboarding/kyc' },
  { id: 'services', label: 'Services', path: '/onboarding/services' },
  { id: 'questionnaire', label: 'Questionnaire', path: '/onboarding/questionnaire' },
  { id: 'review', label: 'Review', path: '/onboarding/review' },
]

export function OnboardingHeader() {
  const pathname = usePathname()
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => pathname.startsWith(s.path))

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-4xl px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            <span className="text-sm font-semibold text-foreground">AiTek Portal</span>
          </div>

          {/* Step indicators */}
          <nav className="hidden items-center gap-1 sm:flex">
            {ONBOARDING_STEPS.map((step, i) => {
              const isCompleted = i < currentIndex
              const isCurrent = i === currentIndex
              return (
                <div key={step.id} className="flex items-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={[
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                        isCompleted
                          ? 'bg-primary text-white'
                          : isCurrent
                            ? 'border-2 border-primary bg-white text-primary'
                            : 'bg-muted text-muted-foreground',
                      ].join(' ')}
                    >
                      {isCompleted ? '✓' : i + 1}
                    </div>
                    <span
                      className={[
                        'text-xs font-medium',
                        isCurrent ? 'text-foreground' : 'text-muted-foreground',
                      ].join(' ')}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < ONBOARDING_STEPS.length - 1 && (
                    <div
                      className={[
                        'mx-1 h-px w-6',
                        isCompleted ? 'bg-primary' : 'bg-border',
                      ].join(' ')}
                    />
                  )}
                </div>
              )
            })}
          </nav>

          {/* Save indicator */}
          <p className="text-xs text-muted-foreground">Progress auto-saved</p>
        </div>
      </div>
    </header>
  )
}
