'use client'

import { useState } from 'react'

import { QuestionType } from '@aitek/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronUp,
  FileQuestion,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'

// The 8 types the client questionnaire fully renders today.
const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: QuestionType.TEXT, label: 'Short text' },
  { value: QuestionType.LONG_TEXT, label: 'Long text' },
  { value: QuestionType.MULTIPLE_CHOICE, label: 'Multiple choice (pick one)' },
  { value: QuestionType.CHECKBOX, label: 'Checkboxes (pick many)' },
  { value: QuestionType.BUDGET_SLIDER, label: 'Budget slider' },
  { value: QuestionType.TIMELINE_SELECTOR, label: 'Timeline selector' },
  { value: QuestionType.TEAM_SIZE, label: 'Team size' },
  { value: QuestionType.URL_INPUT, label: 'URL' },
]

const typeLabel = (t: QuestionType) => TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t

interface AdminQuestion {
  id: string
  text: string
  helpText: string | null
  type: QuestionType
  isRequired: boolean
  sortOrder: number
  options: unknown
  budgetMin: number | null
  budgetMax: number | null
  budgetStep: number | null
  budgetCurrency: string | null
  timelineOptions: unknown
}

interface TemplateGroup {
  templateId: string
  templateName: string
  isDefault: boolean
  serviceId: string | null
  serviceName: string
  categoryName: string | null
  questions: AdminQuestion[]
}

interface QuestionPayload {
  text: string
  helpText?: string | null
  type: QuestionType
  isRequired: boolean
  options?: string[]
  budgetMin?: number
  budgetMax?: number
  budgetStep?: number
  budgetCurrency?: string
  timelineOptions?: string[]
}

function extractMessage(err: unknown, fallback: string): string {
  return typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
    ? (err as { response: { data: { message: string } } }).response.data.message
    : fallback
}

const isChoiceType = (t: QuestionType) =>
  t === QuestionType.MULTIPLE_CHOICE || t === QuestionType.CHECKBOX

// ─── Question add/edit form ───────────────────────────────────────────────────

function QuestionForm({
  initial,
  saving,
  error,
  onSave,
  onCancel,
}: {
  initial?: AdminQuestion
  saving: boolean
  error: string | null
  onSave: (payload: QuestionPayload) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initial?.text ?? '')
  const [helpText, setHelpText] = useState(initial?.helpText ?? '')
  const [type, setType] = useState<QuestionType>(initial?.type ?? QuestionType.TEXT)
  const [isRequired, setIsRequired] = useState(initial?.isRequired ?? true)
  const [optionsText, setOptionsText] = useState(
    initial
      ? (
          (isChoiceType(initial.type) ? (initial.options as string[]) : null) ??
          (initial.type === QuestionType.TIMELINE_SELECTOR
            ? (initial.timelineOptions as string[])
            : null) ??
          []
        ).join('\n')
      : '',
  )
  const [budgetMin, setBudgetMin] = useState(String(initial?.budgetMin ?? 5000))
  const [budgetMax, setBudgetMax] = useState(String(initial?.budgetMax ?? 500000))
  const [budgetStep, setBudgetStep] = useState(String(initial?.budgetStep ?? 5000))
  const [budgetCurrency, setBudgetCurrency] = useState(initial?.budgetCurrency ?? 'USD')

  const showOptions = isChoiceType(type)
  const showTimeline = type === QuestionType.TIMELINE_SELECTOR
  const showBudget = type === QuestionType.BUDGET_SLIDER

  const submit = () => {
    const lines = optionsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const payload: QuestionPayload = {
      text: text.trim(),
      helpText: helpText.trim() || null,
      type,
      isRequired,
      ...(showOptions ? { options: lines } : {}),
      ...(showTimeline ? { timelineOptions: lines } : {}),
      ...(showBudget
        ? {
            budgetMin: Number(budgetMin) || 0,
            budgetMax: Number(budgetMax) || 0,
            budgetStep: Number(budgetStep) || 1,
            budgetCurrency: budgetCurrency.trim() || 'USD',
          }
        : {}),
    }
    onSave(payload)
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Question</label>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Question text" autoFocus />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
            />
            Required
          </label>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Help text (optional)</label>
        <Input
          value={helpText}
          onChange={(e) => setHelpText(e.target.value)}
          placeholder="Shown under the question"
        />
      </div>

      {(showOptions || showTimeline) && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {showTimeline ? 'Timeline options' : 'Options'} — one per line
          </label>
          <textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            rows={4}
            placeholder={'Option A\nOption B\nOption C'}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      {showBudget && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Min</label>
            <Input type="number" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Max</label>
            <Input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Step</label>
            <Input type="number" value={budgetStep} onChange={(e) => setBudgetStep(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Currency</label>
            <Input value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value)} />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={saving || !text.trim()}>
          {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminQuestionnairesPage() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingTemplateId, setAddingTemplateId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<TemplateGroup[]>({
    queryKey: ['admin-questionnaires'],
    queryFn: async () =>
      (await api.get<{ data: TemplateGroup[] }>('/questionnaire/admin/templates')).data.data,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-questionnaires'] })
  const closeForms = () => {
    setEditingId(null)
    setAddingTemplateId(null)
    setErrorMessage(null)
  }

  const createMutation = useMutation({
    mutationFn: async ({ templateId, payload }: { templateId: string; payload: QuestionPayload }) => {
      setErrorMessage(null)
      await api.post(`/questionnaire/admin/templates/${templateId}/questions`, payload)
    },
    onSuccess: () => {
      closeForms()
      void invalidate()
    },
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to add question.')),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: QuestionPayload }) => {
      setErrorMessage(null)
      await api.patch(`/questionnaire/admin/questions/${id}`, payload)
    },
    onSuccess: () => {
      closeForms()
      void invalidate()
    },
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to save question.')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setErrorMessage(null)
      await api.delete(`/questionnaire/admin/questions/${id}`)
    },
    onSuccess: () => void invalidate(),
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to delete question.')),
  })

  const reorderMutation = useMutation({
    mutationFn: async ({ templateId, orderedIds }: { templateId: string; orderedIds: string[] }) => {
      setErrorMessage(null)
      await api.post(`/questionnaire/admin/templates/${templateId}/reorder`, { orderedIds })
    },
    onSuccess: () => void invalidate(),
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to reorder.')),
  })

  const move = (group: TemplateGroup, index: number, dir: -1 | 1) => {
    const ids = group.questions.map((q) => q.id)
    const target = index + dir
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    reorderMutation.mutate({ templateId: group.templateId, orderedIds: ids })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Onboarding questionnaires</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The questions each client sees are assembled from the services they pick. Edit, reorder,
          add, or remove the questions for any service below — changes apply to new onboardings
          immediately.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Failed to load questionnaires.
        </div>
      )}

      <div className="space-y-5">
        {data?.map((group) => (
          <section
            key={group.templateId}
            className="overflow-hidden rounded-xl border border-border bg-background"
          >
            <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileQuestion className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">{group.serviceName}</h2>
                  {group.isDefault && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      Asked of everyone
                    </span>
                  )}
                </div>
                {group.categoryName && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{group.categoryName}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {group.questions.length} question{group.questions.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="divide-y divide-border">
              {group.questions.map((q, index) => (
                <div key={q.id} className="px-4 py-3">
                  {editingId === q.id ? (
                    <QuestionForm
                      initial={q}
                      saving={updateMutation.isPending}
                      error={errorMessage}
                      onSave={(payload) => updateMutation.mutate({ id: q.id, payload })}
                      onCancel={closeForms}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{q.text}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {typeLabel(q.type)}
                          </span>
                          {!q.isRequired && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                              Optional
                            </span>
                          )}
                        </div>
                        {q.helpText && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{q.helpText}</p>
                        )}
                        {isChoiceType(q.type) && Array.isArray(q.options) && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(q.options as string[]).join(' · ')}
                          </p>
                        )}
                        {q.type === QuestionType.TIMELINE_SELECTOR &&
                          Array.isArray(q.timelineOptions) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {(q.timelineOptions as string[]).join(' · ')}
                            </p>
                          )}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => move(group, index, -1)}
                          disabled={index === 0 || reorderMutation.isPending}
                          className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                          title="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(group, index, 1)}
                          disabled={index === group.questions.length - 1 || reorderMutation.isPending}
                          className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                          title="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingTemplateId(null)
                            setEditingId(q.id)
                            setErrorMessage(null)
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Delete this question? Any answers clients gave to it are removed too.'))
                              deleteMutation.mutate(q.id)
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {group.questions.length === 0 && addingTemplateId !== group.templateId && (
                <p className="px-4 py-3 text-xs text-muted-foreground">No questions yet.</p>
              )}

              {/* Add question */}
              <div className="px-4 py-3">
                {addingTemplateId === group.templateId ? (
                  <QuestionForm
                    saving={createMutation.isPending}
                    error={errorMessage}
                    onSave={(payload) =>
                      createMutation.mutate({ templateId: group.templateId, payload })
                    }
                    onCancel={closeForms}
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingId(null)
                      setAddingTemplateId(group.templateId)
                      setErrorMessage(null)
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add question
                  </Button>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
