'use client'

import { useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import { OnboardingPhase } from '@aitek/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Paperclip, Sparkles, X } from 'lucide-react'

import { BotBubble } from '@/components/onboarding/bot-bubble'
import { ChatShell } from '@/components/onboarding/chat-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useOnboardingPhaseGuard } from '@/hooks/useOnboardingProgress'
import { api } from '@/lib/api'

const TIMELINE_OPTIONS = [
  'ASAP',
  '< 1 month',
  '1-3 months',
  '3-6 months',
  '6-12 months',
  'Just exploring',
]

interface ExistingCustomRequest {
  id: string
  description: string
  goals: string | null
  budget: string | null
  timeline: string | null
  fileKeys: string[]
}

export default function CustomRequestPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { ready, reviewMode } = useOnboardingPhaseGuard(OnboardingPhase.SERVICES)

  const [description, setDescription] = useState('')
  const [goals, setGoals] = useState('')
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [fileNames, setFileNames] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prefilled, setPrefilled] = useState(false)

  const { data: existing } = useQuery<ExistingCustomRequest | null>({
    queryKey: ['custom-request-me'],
    queryFn: async () =>
      (await api.get<{ data: ExistingCustomRequest | null }>('/custom-requests/me')).data.data,
  })

  useEffect(() => {
    if (existing && !prefilled) {
      setDescription(existing.description ?? '')
      setGoals(existing.goals ?? '')
      setBudget(existing.budget ?? '')
      setTimeline(existing.timeline ?? '')
      setFileNames(existing.fileKeys ?? [])
      setPrefilled(true)
    }
  }, [existing, prefilled])

  const addFiles = (files: FileList | null) => {
    if (!files) return
    setFileNames((cur) => [...cur, ...Array.from(files).map((f) => f.name)])
  }
  const removeFile = (name: string) =>
    setFileNames((cur) => cur.filter((n) => n !== name))

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please describe what you are looking for.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/custom-requests', {
        description: description.trim(),
        goals: goals.trim() || undefined,
        budget: budget.trim() || undefined,
        timeline: timeline || undefined,
        fileKeys: fileNames,
      })
      await queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] })
      await queryClient.invalidateQueries({ queryKey: ['custom-request-me'] })
      await queryClient.invalidateQueries({ queryKey: ['current-user'] })
      router.push('/onboarding/review')
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
    <ChatShell currentStep="questionnaire">
      {reviewMode && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
          You&apos;re editing your custom request. Save to return to your review.
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push(`/onboarding/services${reviewMode ? '?return=review' : ''}`)}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to services
      </button>

      <BotBubble>
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Tell us what you&apos;re looking for. Be as detailed as you like &mdash; our team will
            review it and follow up to scope a custom project.
          </span>
        </div>
      </BotBubble>

      <BotBubble className="!max-w-full">
        <div className="w-full space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              What are you looking for? <span className="text-destructive">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Describe the project, problem, or idea…"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              What are your goals? <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={3}
              placeholder="What does success look like?"
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Budget <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="e.g. $25k–50k"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Timeline <span className="text-muted-foreground">(optional)</span>
              </label>
              <select
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select…</option>
                {TIMELINE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Attachments <span className="text-muted-foreground">(optional)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
              <Paperclip className="h-4 w-4" />
              Add files
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
            {fileNames.length > 0 && (
              <ul className="space-y-1">
                {fileNames.map((name) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground"
                  >
                    <span className="truncate">{name}</span>
                    <button type="button" onClick={() => removeFile(name)}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-muted-foreground">
              Stub mode: filenames are recorded for reference — file contents aren&apos;t stored yet.
            </p>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting || !description.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? 'Submitting…' : reviewMode ? 'Save & return to review' : 'Submit request'}
            </Button>
          </div>
        </div>
      </BotBubble>
    </ChatShell>
  )
}
