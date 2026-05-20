'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@clerk/nextjs'
import { Building2, Check, Globe, Loader2, Users } from 'lucide-react'

import { createCompanySchema, type CreateCompanyInput } from '@aitek/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompanyPage() {
  const router = useRouter()
  const { getToken } = useAuth()

  const [step, setStep] = useState(1)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [softwareStack, setSoftwareStack] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      socialLinks: { linkedin: '', twitter: '' },
      existingSoftwareStack: [],
    },
  })

  // Check if user already has a company
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const token = await getToken()
        const res = await api.get<{ data: { id: string } }>('/companies/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setCompanyId(res.data.data.id)
      } catch {
        // No company yet — normal for new users
      }
    }
    void fetchExisting()
  }, [getToken])

  const autoSave = useCallback(
    async (data: Partial<CreateCompanyInput>) => {
      if (!companyId) return
      setAutoSaveStatus('saving')
      try {
        const token = await getToken()
        await api.put('/companies/me', data, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch {
        setAutoSaveStatus('idle')
      }
    },
    [companyId, getToken],
  )

  const handleStep1 = async () => {
    const valid = await trigger(['name', 'businessType', 'industry', 'country', 'state', 'website'])
    if (!valid) return

    setSaving(true)
    try {
      const token = await getToken()
      const values = watch()
      if (companyId) {
        await api.put('/companies/me', values, {
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        const res = await api.post<{ data: { id: string } }>('/companies', values, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setCompanyId(res.data.data.id)
      }
      setStep(2)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleStep2 = async () => {
    setSaving(true)
    try {
      await autoSave({ socialLinks: watch('socialLinks') })
      setStep(3)
    } finally {
      setSaving(false)
    }
  }

  const handleStep3 = handleSubmit(async (data) => {
    setSaving(true)
    try {
      const token = await getToken()
      await api.put(
        '/companies/me',
        { ...data, existingSoftwareStack: softwareStack },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      router.push('/onboarding/kyc')
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  })

  return (
    <div className="mx-auto max-w-xl space-y-8">
      {/* Stepper */}
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

      {/* Auto-save indicator */}
      {autoSaveStatus !== 'idle' && (
        <p className="text-center text-xs text-muted-foreground">
          {autoSaveStatus === 'saving' ? (
            <span className="flex items-center justify-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          ) : (
            'Saved'
          )}
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          {/* ── Step 1: Company basics ── */}
          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleStep1()
              }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold">Tell us about your company</h2>

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
                  <Input
                    id="businessType"
                    {...register('businessType')}
                    placeholder="LLC, Corp…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    {...register('industry')}
                    placeholder="Healthcare, Finance…"
                  />
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
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State / Province</Label>
                  <Input id="state" {...register('state')} placeholder="California" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input id="website" {...register('website')} placeholder="https://example.com" />
                {errors.website && (
                  <p className="text-xs text-destructive">{errors.website.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </form>
          )}

          {/* ── Step 2: Online presence ── */}
          {step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleStep2()
              }}
              className="space-y-4"
            >
              <h2 className="text-lg font-semibold">Online presence</h2>
              <p className="text-sm text-muted-foreground">
                Optional — helps us understand your brand.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  {...register('socialLinks.linkedin')}
                  placeholder="https://linkedin.com/company/your-company"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="twitter">Twitter / X</Label>
                <Input
                  id="twitter"
                  {...register('socialLinks.twitter')}
                  placeholder="https://twitter.com/yourhandle"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </div>
            </form>
          )}

          {/* ── Step 3: Financial + tech context ── */}
          {step === 3 && (
            <form onSubmit={handleStep3} className="space-y-4">
              <h2 className="text-lg font-semibold">Financial & technology context</h2>
              <p className="text-sm text-muted-foreground">
                Helps us scope your project accurately.
              </p>

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
                  value={softwareStack}
                  onChange={setSoftwareStack}
                  placeholder="e.g. Salesforce, React, AWS…"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(2)}
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue to KYC
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
