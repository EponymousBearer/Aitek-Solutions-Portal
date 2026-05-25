'use client'

import { useEffect, useRef } from 'react'

const STEP_ORDER = ['company', 'kyc', 'services', 'questionnaire'] as const
type Step = (typeof STEP_ORDER)[number]

const STEP_LABELS: Record<Step, string> = {
  company: 'Your company',
  kyc: 'Identity',
  services: 'Services',
  questionnaire: 'Requirements',
}

// Scrolling chat surface with a header progress bar. Auto-scrolls to bottom
// whenever children change so the latest bubble is always visible.
export function ChatShell({
  currentStep,
  children,
}: {
  currentStep: Step
  children: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  })

  const currentIndex = STEP_ORDER.indexOf(currentStep)
  const progress = ((currentIndex + 1) / STEP_ORDER.length) * 100

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col">
      {/* Progress header */}
      <div className="border-b px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            Step {currentIndex + 1} of {STEP_ORDER.length}: {STEP_LABELS[currentStep]}
          </span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Message stream */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {children}
      </div>
    </div>
  )
}

export { STEP_ORDER, STEP_LABELS }
export type { Step }
