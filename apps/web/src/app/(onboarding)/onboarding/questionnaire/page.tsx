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

interface TemplateQuestion {
  id: string
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

interface DefaultTemplate {
  id: string
  name: string
  slug: string
  description: string | null
  version: number
  questions: TemplateQuestion[]
}

interface ResponseRecord {
  id: string
  sessionId: string
  templateId: string
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
  const [responseId, setResponseId] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const [botReady, setBotReady] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: template, isLoading } = useQuery<DefaultTemplate>({
    queryKey: ['questionnaire-default'],
    queryFn: async () =>
      (await api.get<{ data: DefaultTemplate }>('/questionnaire/templates/default')).data.data,
  })

  // When editing from the review step, pre-load existing answers so the client
  // re-walks the questions with their previous responses pre-filled.
  const { data: existingSession } = useQuery<ExistingSession | null>({
    queryKey: ['onboarding-session'],
    queryFn: async () =>
      (await api.get<{ data: ExistingSession | null }>('/onboarding/sessions/me')).data.data,
    enabled: reviewMode,
  })

  useEffect(() => {
    const prior = existingSession?.responses?.[0]?.answers
    if (reviewMode && prior && prior.length > 0) {
      setAnswers((cur) => {
        const map: Record<string, unknown> = {}
        for (const a of prior) map[a.questionId] = a.jsonValue
        return { ...map, ...cur }
      })
    }
  }, [reviewMode, existingSession])

  // Bootstrap a response row once the template loads.
  useEffect(() => {
    if (!template || responseId) return
    void api
      .post<{ data: ResponseRecord }>('/onboarding/responses', { templateId: template.id })
      .then((r) => setResponseId(r.data.data.id))
      .catch((err) => {
        console.error(err)
        setSubmitError('Failed to start questionnaire. Try refreshing the page.')
      })
  }, [template, responseId])

  // Slight delay before showing the first bubble for a more natural feel.
  useEffect(() => {
    if (template && !isLoading) {
      const t = setTimeout(() => setBotReady(true), 500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [template, isLoading])

  const questions = useMemo(() => template?.questions ?? [], [template])
  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex])
  const allDone = botReady && currentIndex >= questions.length && questions.length > 0

  const handleAnswer = async (value: unknown) => {
    if (!currentQuestion || !responseId) return
    setAnswers((cur) => ({ ...cur, [currentQuestion.id]: value }))

    try {
      await api.post(`/onboarding/responses/${responseId}/answers`, {
        answers: [{ questionId: currentQuestion.id, value }],
      })
      setCurrentIndex((i) => i + 1)
    } catch (err) {
      console.error(err)
      setSubmitError('Failed to save your answer. Please retry.')
    }
  }

  const handleSubmitAll = async () => {
    if (!responseId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await api.post<{ data: { phase: OnboardingPhase } }>(
        `/onboarding/responses/${responseId}/submit`,
      )
      await queryClient.invalidateQueries({ queryKey: ['current-user'] })
      await queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] })
      if (reviewMode) {
        router.push('/onboarding/review')
        return
      }
      // After the questionnaire the pointer advances to REVIEW.
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
        Last step. I&apos;ll ask a few questions about your project so we can scope it accurately. There
        are no wrong answers &mdash; short replies are fine.
      </BotBubble>

      {!botReady && <TypingIndicator />}

      {/* Render answered questions as completed Q+A pairs */}
      {questions.slice(0, currentIndex).map((q) => (
        <div key={q.id} className="space-y-3">
          <BotBubble>{q.text}</BotBubble>
          <UserBubble>{formatValue(answers[q.id])}</UserBubble>
        </div>
      ))}

      {/* Current question */}
      {botReady && currentQuestion && (
        <>
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
          </div>
        </>
      )}

      {/* All questions answered — confirm */}
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
