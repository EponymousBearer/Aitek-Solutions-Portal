'use client'

import { useState } from 'react'

import { QuestionType } from '@aitek/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Polymorphic input for a single questionnaire question. Returns the raw
// value via onSubmit when the user confirms (Enter, button click, etc.).
// Storage layer treats every value as JSON (jsonValue column in Prisma).
export interface QuestionLike {
  id: string
  text: string
  helpText?: string | null
  type: QuestionType
  options?: unknown
  budgetMin?: number | null
  budgetMax?: number | null
  budgetStep?: number | null
  budgetCurrency?: string | null
  timelineOptions?: unknown
}

export function QuestionInput({
  question,
  onSubmit,
  disabled,
}: {
  question: QuestionLike
  onSubmit: (value: unknown) => void
  disabled?: boolean
}) {
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [budget, setBudget] = useState(question.budgetMin ?? 0)

  const submitText = () => {
    if (!text.trim()) return
    onSubmit(text.trim())
    setText('')
  }
  const submitPicked = (single = false) => {
    if (picked.length === 0) return
    onSubmit(single ? picked[0] : picked)
    setPicked([])
  }
  const togglePick = (opt: string, single: boolean) => {
    if (single) setPicked([opt])
    else setPicked((cur) => (cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]))
  }

  switch (question.type) {
    case QuestionType.TEXT:
    case QuestionType.URL_INPUT:
    case QuestionType.TEAM_SIZE:
      return (
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitText()
              }
            }}
            placeholder="Type your answer…"
            disabled={disabled}
            autoFocus
          />
          <Button onClick={submitText} disabled={disabled || !text.trim()}>
            Send
          </Button>
        </div>
      )

    case QuestionType.LONG_TEXT:
      return (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer (Cmd/Ctrl+Enter to send)…"
            disabled={disabled}
            rows={4}
            autoFocus
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submitText()
              }
            }}
          />
          <div className="flex justify-end">
            <Button onClick={submitText} disabled={disabled || !text.trim()}>
              Send
            </Button>
          </div>
        </div>
      )

    case QuestionType.MULTIPLE_CHOICE: {
      const opts = (question.options as string[]) ?? []
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {opts.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => togglePick(opt, true)}
                disabled={disabled}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  picked[0] === opt
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => submitPicked(true)} disabled={disabled || picked.length === 0}>
              Confirm
            </Button>
          </div>
        </div>
      )
    }

    case QuestionType.CHECKBOX: {
      const opts = (question.options as string[]) ?? []
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {opts.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => togglePick(opt, false)}
                disabled={disabled}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  picked.includes(opt)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => submitPicked(false)} disabled={disabled || picked.length === 0}>
              Confirm ({picked.length})
            </Button>
          </div>
        </div>
      )
    }

    case QuestionType.BUDGET_SLIDER: {
      const min = question.budgetMin ?? 0
      const max = question.budgetMax ?? 100_000
      const step = question.budgetStep ?? 1000
      const currency = question.budgetCurrency ?? 'USD'
      return (
        <div className="space-y-3">
          <div className="text-center text-lg font-semibold">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(budget)}
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            disabled={disabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(min)}</span>
            <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(max)}</span>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => onSubmit(budget)} disabled={disabled}>
              Send
            </Button>
          </div>
        </div>
      )
    }

    case QuestionType.TIMELINE_SELECTOR: {
      const opts = (question.timelineOptions as string[]) ?? []
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {opts.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => togglePick(opt, true)}
                disabled={disabled}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  picked[0] === opt
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => submitPicked(true)} disabled={disabled || picked.length === 0}>
              Confirm
            </Button>
          </div>
        </div>
      )
    }

    default:
      // Fallback for RATING_SCALE, FILE_UPLOAD, VOICE_NOTE — treat as text.
      return (
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`(${question.type}) — fallback text input`}
            disabled={disabled}
          />
          <Button onClick={submitText} disabled={disabled || !text.trim()}>
            Send
          </Button>
        </div>
      )
  }
}
