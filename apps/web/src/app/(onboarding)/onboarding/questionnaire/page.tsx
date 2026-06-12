'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import { OnboardingPhase, type QuestionType } from '@aitek/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { BotBubble } from '@/components/onboarding/bot-bubble'
import { ChatShell } from '@/components/onboarding/chat-shell'
import { QuestionInput } from '@/components/onboarding/question-input'
import { TypingIndicator } from '@/components/onboarding/typing-indicator'
import { UserBubble } from '@/components/onboarding/user-bubble'
import { Button } from '@/components/ui/button'
import { useOnboardingPhaseGuard } from '@/hooks/useOnboardingProgress'
import { api } from '@/lib/api'
import { routeForPhase } from '@/lib/onboarding'

interface DynamicQuestion {
  id: string
  templateId: string
  group: string
  text: string
  helpText: string | null
  type: QuestionType
  isRequired: boolean
  section: string | null
  sortOrder: number
  options: unknown
  budgetMin: number | null
  budgetMax: number | null
  budgetStep: number | null
  budgetCurrency: string | null
  timelineOptions: unknown
}

const formatValue = (value: unknown): string => {
  if (value == null) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

interface ExistingAnswer {
  questionId: string
  jsonValue: unknown
}
interface ExistingSession {
  responses: Array<{ answers: ExistingAnswer[] }>
}

export default function QuestionnairePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { ready, reviewMode } = useOnboardingPhaseGuard(OnboardingPhase.QUESTIONNAIRE)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [botReady, setBotReady] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Questionnaire is assembled server-side from the client's selected services.
  const { data, isLoading } = useQuery<{ questions: DynamicQuestion[] }>({
    queryKey: ['questionnaire-dynamic'],
    queryFn: async () =>
      (await api.get<{ data: { questions: DynamicQuestion[] } }>('/onboarding/questionnaire')).data
        .data,
  })

  // When editing from review, pre-load existing answers (across all responses).
  const { data: existingSession } = useQuery<ExistingSession | null>({
    queryKey: ['onboarding-session'],
    queryFn: async () =>
      (await api.get<{ data: ExistingSession | null }>('/onboarding/sessions/me')).data.data,
    enabled: reviewMode,
  })

  useEffect(() => {
    const prior = existingSession?.responses?.flatMap((r) => r.answers) ?? []
    if (reviewMode && prior.length > 0) {
      setAnswers((cur) => {
        const map: Record<string, unknown> = {}
        for (const a of prior) map[a.questionId] = a.jsonValue
        return { ...map, ...cur }
      })
    }
  }, [reviewMode, existingSession])

  // Slight delay before the first bubble for a more natural feel.
  useEffect(() => {
    if (data && !isLoading) {
      const t = setTimeout(() => setBotReady(true), 500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [data, isLoading])

  const questions = useMemo(() => data?.questions ?? [], [data])
  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex])
  const allDone = botReady && currentIndex >= questions.length && questions.length > 0

  // Show a group header bubble whenever the service group changes.
  const groupHeaderFor = (index: number): string | null => {
    const q = questions[index]
    if (!q) return null
    if (index === 0) return q.group
    return questions[index - 1]?.group === q.group ? null : q.group
  }

  const handleAnswer = async (value: unknown) => {
    if (!currentQuestion) return
    setAnswers((cur) => ({ ...cur, [currentQuestion.id]: value }))
    try {
      await api.post('/onboarding/questionnaire/answers', {
        answers: [{ questionId: currentQuestion.id, value }],
      })
      setCurrentIndex((i) => i + 1)
    } catch (err) {
      console.error(err)
      setSubmitError('Failed to save your answer. Please retry.')
    }
  }

  const handleSubmitAll = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await api.post<{ data: { phase: OnboardingPhase } }>(
        '/onboarding/questionnaire/submit',
      )
      await queryClient.invalidateQueries({ queryKey: ['current-user'] })
      await queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] })
      if (reviewMode) {
        router.push('/onboarding/review')
        return
      }
      router.push(routeForPhase(res.data.data.phase))
    } catch (err) {
      console.error(err)
      setSubmitError('Failed to submit. Please try again.')
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
    <ChatShell currentStep="questionnaire">
      {reviewMode && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
          You&apos;re editing your answers. Re-confirm each one to return to your review.
        </div>
      )}
      <BotBubble>
        Last step. I&apos;ll ask a few questions tailored to the services you picked so we can scope
        things accurately. Short replies are fine.
      </BotBubble>

      {!botReady && <TypingIndicator />}

      {botReady && questions.length === 0 && (
        <BotBubble>
          No questions to ask &mdash; head back to{' '}
          <button
            type="button"
            className="underline"
            onClick={() => router.push('/onboarding/services')}
          >
            services
          </button>{' '}
          to pick what you need.
        </BotBubble>
      )}

      {/* Answered questions as completed Q+A pairs */}
      {questions.slice(0, currentIndex).map((q, i) => (
        <div key={q.id} className="space-y-3">
          {groupHeaderFor(i) && (
            <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {groupHeaderFor(i)}
            </div>
          )}
          <BotBubble>{q.text}</BotBubble>
          <UserBubble>{formatValue(answers[q.id])}</UserBubble>
        </div>
      ))}

      {/* Current question */}
      {botReady && currentQuestion && (
        <>
          {groupHeaderFor(currentIndex) && (
            <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {groupHeaderFor(currentIndex)}
            </div>
          )}
          <BotBubble>
            <div className="space-y-1">
              <div>{currentQuestion.text}</div>
              {currentQuestion.helpText && (
                <div className="text-xs text-muted-foreground">{currentQuestion.helpText}</div>
              )}
            </div>
          </BotBubble>
          <div className="pl-11">
            <QuestionInput
              key={currentQuestion.id}
              question={currentQuestion}
              onSubmit={handleAnswer}
              disabled={submitting}
              initialValue={answers[currentQuestion.id]}
            />
            {!currentQuestion.isRequired && (
              <button
                type="button"
                onClick={() => handleAnswer(answers[currentQuestion.id] ?? '')}
                className="mt-2 text-xs text-muted-foreground underline"
              >
                Skip this question
              </button>
            )}
          </div>
        </>
      )}

      {/* All answered — confirm */}
      {allDone && (
        <>
          <BotBubble>
            {reviewMode
              ? "That's everything. Head back to your review to finish up."
              : "That's everything I need. Next you'll get one last look at everything before it goes to our team."}
          </BotBubble>
          {submitError && <BotBubble className="text-destructive">{submitError}</BotBubble>}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSubmitAll} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting
                ? 'Saving…'
                : reviewMode
                  ? 'Save & return to review'
                  : 'Continue to review'}
            </Button>
          </div>
        </>
      )}
    </ChatShell>
  )
}
