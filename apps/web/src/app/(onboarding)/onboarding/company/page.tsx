'use client'

import { useCallback, useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import { type CreateCompanyInput, createCompanySchema } from '@aitek/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Check, Globe, Loader2, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'

import { BotBubble } from '@/components/onboarding/bot-bubble'
import { ChatShell } from '@/components/onboarding/chat-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api } from '@/lib/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Company', icon: Building2 },
  { id: 2, label: 'Online presence', icon: Globe },
  { id: 3, label: 'Context', icon: Users },
] as const

const EMPLOYEE_OPTIONS = ['1–10', '11–50', '51–200', '201–500', '500+']
const REVENUE_OPTIONS = ['<$100k', '$100k–$500k', '$500k–$1M', '$1M–$5M', '$5M–$20M', '$20M+']
const YEARS_OPTIONS = ['<1 year', '1–3 years', '3–5 years', '5–10 years', '10+ years']

// ─── Native select component ──────────────────────────────────────────────────

function NativeSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id?: string
  value?: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}

// ─── Tags input ───────────────────────────────────────────────────────────────

function TagsInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  const addTag = () => {
    const tag = input.trim()
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setInput('')
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            }
          }}
          placeholder={placeholder ?? 'Type and press Enter'}
        />
        <Button type="button" variant="outline" size="sm" onClick={addTag}>
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-sm text-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="ml-0.5 hover:text-primary/70"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Stepper indicator ────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-between">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                step > s.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : step === s.id
                    ? 'border-primary text-primary'
                    : 'border-muted text-muted-foreground'
              }`}
            >
              {step > s.id ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
            </div>
            <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`mx-2 h-0.5 flex-1 transition-colors ${step > s.id ? 'bg-primary' : 'bg-muted'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ExistingCompany {
  id: string
  name: string
  businessType: string | null
  industry: string | null
  employeeCount: string | null
  country: string | null
  state: string | null
  website: string | null
  socialLinks: { linkedin?: string; twitter?: string } | null
  annualRevenueRange: string | null
  yearsInBusiness: string | null
  existingSoftwareStack: string[] | null
}

export default function CompanyPage() {
  const router = useRouter()
  const { isAdmin, isAitekTeam, isLoading: userLoading } = useCurrentUser()

  useEffect(() => {
    if (!userLoading && (isAdmin || isAitekTeam)) {
      router.replace('/portal')
    }
  }, [userLoading, isAdmin, isAitekTeam, router])

  const [step, setStep] = useState(1)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const extractError = (err: unknown): string => {
    if (typeof err === 'object' && err !== null && 'response' in err) {
      const resp = (err as { response?: { data?: { message?: string } } }).response
      if (resp?.data?.message) return resp.data.message
    }
    if (err instanceof Error) return err.message
    return 'Something went wrong. Please try again.'
  }

  const {
    register,
    setValue,
    watch,
    trigger,
    reset,
    formState: { errors },
  } = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    // Validate each field when it loses focus, then re-validate on change, so
    // inline errors appear as the user moves through the form.
    mode: 'onTouched',
    defaultValues: {
      socialLinks: { linkedin: '', twitter: '' },
      existingSoftwareStack: [],
    },
  })

  // Prefill from server on mount. We do NOT redirect away — the wizard should
  // be replayable so the user can finish steps 2/3 they may not have completed.
  // PortalGuard handles "user already finished onboarding" cases.
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await api.get<{ data: ExistingCompany }>('/companies/me')
        const c = res.data.data
        setCompanyId(c.id)
        reset({
          name: c.name,
          businessType: c.businessType ?? undefined,
          industry: c.industry ?? undefined,
          employeeCount: c.employeeCount ?? undefined,
          country: c.country ?? undefined,
          state: c.state ?? undefined,
          website: c.website ?? '',
          socialLinks: {
            linkedin: c.socialLinks?.linkedin ?? '',
            twitter: c.socialLinks?.twitter ?? '',
          },
          existingSoftwareStack: c.existingSoftwareStack ?? [],
          annualRevenueRange: c.annualRevenueRange ?? undefined,
          yearsInBusiness: c.yearsInBusiness ?? undefined,
        })
      } catch {
        // No company yet — fine.
      }
    }
    void fetchExisting()
  }, [reset])

  const autoSave = useCallback(
    async (data: Partial<CreateCompanyInput>) => {
      if (!companyId) return
      setAutoSaveStatus('saving')
      try {
        await api.put('/companies/me', data)
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch {
        setAutoSaveStatus('idle')
      }
    },
    [companyId],
  )

  const handleStep1 = async () => {
    const valid = await trigger(['name', 'businessType', 'industry', 'country', 'state', 'website'])
    if (!valid) return

    setSaving(true)
    setSubmitError(null)
    try {
      const values = watch()
      if (companyId) {
        await api.put('/companies/me', values)
      } else {
        const res = await api.post<{ data: { id: string } }>('/companies', values)
        setCompanyId(res.data.data.id)
      }
      setStep(2)
    } catch (err) {
      setSubmitError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleStep2 = async () => {
    const valid = await trigger(['socialLinks.linkedin', 'socialLinks.twitter'])
    if (!valid) return

    setSaving(true)
    setSubmitError(null)
    try {
      await autoSave({ socialLinks: watch('socialLinks') })
      setStep(3)
    } catch (err) {
      setSubmitError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  // Steps 2 & 3 are optional enrichment; the required fields were already
  // validated in step 1. Don't gate "Continue" on a full-schema re-validation
  // here — react-hook-form's handleSubmit was aborting silently whenever an
  // optional field failed (e.g. a non-URL LinkedIn/Twitter typed in step 2),
  // leaving the button dead with no error shown. Save the current values and
  // advance to identity verification.
  const handleStep3 = async () => {
    setSaving(true)
    setSubmitError(null)
    try {
      await api.put('/companies/me', watch())
      router.push('/onboarding/kyc')
    } catch (err) {
      setSubmitError(extractError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ChatShell currentStep="company">
      {step === 1 && (
        <BotBubble>
          Hi! I&apos;m here to set up your AiTek workspace. First, tell me a bit about your company.
        </BotBubble>
      )}
      {step === 2 && (
        <BotBubble>
          Got it. Want to add LinkedIn or X links? Helpful for our team but totally optional.
        </BotBubble>
      )}
      {step === 3 && (
        <BotBubble>
          Last few details &mdash; these help us scope projects accurately. All optional, but every
          field helps.
        </BotBubble>
      )}

      <div className="rounded-2xl border bg-background p-5 shadow-sm">
        <Stepper step={step} />

        {autoSaveStatus !== 'idle' && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {autoSaveStatus === 'saving' ? (
              <span className="inline-flex items-center justify-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            ) : (
              'Saved'
            )}
          </p>
        )}

        <div className="mt-6">
          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleStep1()
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="name">
                  Company name <span className="text-destructive">*</span>
                </Label>
                <Input id="name" {...register('name')} placeholder="Acme Corp" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="businessType">Business type</Label>
                  <Input id="businessType" {...register('businessType')} placeholder="LLC, Corp…" />
                  {errors.businessType && (
                    <p className="text-xs text-destructive">{errors.businessType.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="industry">Industry</Label>
                  <Input id="industry" {...register('industry')} placeholder="Healthcare, Finance…" />
                  {errors.industry && (
                    <p className="text-xs text-destructive">{errors.industry.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="employeeCount">Team size</Label>
                <NativeSelect
                  id="employeeCount"
                  value={watch('employeeCount')}
                  onChange={(v) => setValue('employeeCount', v)}
                  options={EMPLOYEE_OPTIONS}
                  placeholder="Select range"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" {...register('country')} placeholder="United States" />
                  {errors.country && (
                    <p className="text-xs text-destructive">{errors.country.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State / Province</Label>
                  <Input id="state" {...register('state')} placeholder="California" />
                  {errors.state && (
                    <p className="text-xs text-destructive">{errors.state.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" {...register('website')} placeholder="https://example.com" />
                {errors.website && (
                  <p className="text-xs text-destructive">{errors.website.message}</p>
                )}
              </div>

              {submitError && (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Continuing…' : 'Continue'}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleStep2()
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  {...register('socialLinks.linkedin')}
                  placeholder="https://linkedin.com/company/your-company"
                />
                {errors.socialLinks?.linkedin && (
                  <p className="text-xs text-destructive">{errors.socialLinks.linkedin.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="twitter">Twitter / X</Label>
                <Input
                  id="twitter"
                  {...register('socialLinks.twitter')}
                  placeholder="https://twitter.com/yourhandle"
                />
                {errors.socialLinks?.twitter && (
                  <p className="text-xs text-destructive">{errors.socialLinks.twitter.message}</p>
                )}
              </div>

              {submitError && (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                  disabled={saving}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saving ? 'Continuing…' : 'Continue'}
                </Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleStep3()
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label>Annual revenue range</Label>
                <NativeSelect
                  value={watch('annualRevenueRange')}
                  onChange={(v) => setValue('annualRevenueRange', v)}
                  options={REVENUE_OPTIONS}
                  placeholder="Select range"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Years in business</Label>
                <NativeSelect
                  value={watch('yearsInBusiness')}
                  onChange={(v) => setValue('yearsInBusiness', v)}
                  options={YEARS_OPTIONS}
                  placeholder="Select range"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Current software stack</Label>
                <p className="text-xs text-muted-foreground">
                  List tools, platforms, or languages you use.
                </p>
                <TagsInput
                  value={watch('existingSoftwareStack') ?? []}
                  onChange={(tags) => setValue('existingSoftwareStack', tags)}
                  placeholder="e.g. Salesforce, React, AWS…"
                />
              </div>

              {submitError && (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(2)}
                  disabled={saving}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saving ? 'Continuing…' : 'Continue to identity verification'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </ChatShell>
  )
}
