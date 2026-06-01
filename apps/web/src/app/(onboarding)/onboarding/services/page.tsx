'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import { OnboardingPhase } from '@aitek/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Loader2, Sparkles } from 'lucide-react'

import { BotBubble } from '@/components/onboarding/bot-bubble'
import { ChatShell } from '@/components/onboarding/chat-shell'
import { TypingIndicator } from '@/components/onboarding/typing-indicator'
import { UserBubble } from '@/components/onboarding/user-bubble'
import { Button } from '@/components/ui/button'
import { useOnboardingPhaseGuard } from '@/hooks/useOnboardingProgress'
import { api } from '@/lib/api'
import { routeForPhase } from '@/lib/onboarding'

interface CatalogService {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
}

interface CatalogCategory {
  id: string
  name: string
  slug: string
  description: string | null
  services: CatalogService[]
}

export default function ServicesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { ready, reviewMode } = useOnboardingPhaseGuard(OnboardingPhase.SERVICES)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)

  const reviewSuffix = reviewMode ? '?return=review' : ''

  const { data: catalog, isLoading } = useQuery<CatalogCategory[]>({
    queryKey: ['service-catalog'],
    queryFn: async () => (await api.get<{ data: CatalogCategory[] }>('/services')).data.data,
  })

  // Pre-select the client's existing choices (resume / edit-in-review).
  const { data: mySelected } = useQuery<{ id: string }[]>({
    queryKey: ['my-services'],
    queryFn: async () =>
      (await api.get<{ data: { id: string }[] }>('/onboarding/services')).data.data,
  })

  useEffect(() => {
    if (selectedIds.size === 0 && mySelected && mySelected.length > 0) {
      setSelectedIds(new Set(mySelected.map((s) => s.id)))
    }
  }, [mySelected, selectedIds.size])

  // Reveal the catalog after the bot "types" for a moment.
  useEffect(() => {
    if (!isLoading) {
      const t = setTimeout(() => setShowCatalog(true), 600)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isLoading])

  const selectedServices = useMemo(() => {
    if (!catalog) return []
    return catalog
      .flatMap((c) => c.services)
      .filter((s) => selectedIds.has(s.id))
  }, [selectedIds, catalog])

  const toggleCategory = (id: string) => {
    setOpenCategories((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleService = (id: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleContinue = async () => {
    if (selectedIds.size === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await api.post<{ data: { phase: OnboardingPhase } }>('/onboarding/services', {
        serviceIds: Array.from(selectedIds),
      })
      await queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] })
      await queryClient.invalidateQueries({ queryKey: ['my-services'] })
      if (reviewMode) {
        router.push('/onboarding/review')
        return
      }
      router.push(routeForPhase(res.data.data.phase))
    } catch (err) {
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message
          ? (err as { response: { data: { message: string } } }).response.data.message
          : 'Failed to save your selection. Try again.'
      setSubmitError(msg)
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
    <ChatShell currentStep="services">
      {reviewMode && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
          You&apos;re editing this section. Save to return to your review.
        </div>
      )}
      <BotBubble>
        Great &mdash; your identity is being verified. Let&apos;s talk about what we can do for you.
      </BotBubble>
      <BotBubble>
        Which services are the best fit? Pick <strong>everything that applies</strong> &mdash; we&apos;ll
        ask tailored questions for each one next. Not sure, or need something bespoke? Choose
        <em> Something else</em> at the bottom.
      </BotBubble>

      {!showCatalog && <TypingIndicator />}

      {showCatalog && catalog && (
        <BotBubble className="!max-w-full">
          <div className="w-full space-y-2">
            {catalog.map((cat) => (
              <div key={cat.id} className="rounded-lg border border-border bg-background">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{cat.name}</div>
                    {cat.description && (
                      <div className="text-xs text-muted-foreground">{cat.description}</div>
                    )}
                  </div>
                  {openCategories.has(cat.id) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {openCategories.has(cat.id) && (
                  <div className="flex flex-col gap-1 border-t p-3">
                    {cat.services.map((svc) => {
                      const isSelected = selectedIds.has(svc.id)
                      return (
                        <label
                          key={svc.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-background hover:bg-muted/40'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-primary"
                            checked={isSelected}
                            onChange={() => toggleService(svc.id)}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{svc.name}</div>
                            {svc.description && (
                              <div className="text-xs text-muted-foreground">{svc.description}</div>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Something else / custom request */}
            <button
              type="button"
              onClick={() => router.push(`/onboarding/custom-request${reviewSuffix}`)}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-3 text-left transition-colors hover:bg-primary/10"
            >
              <Sparkles className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <div className="text-sm font-medium text-foreground">Something else</div>
                <div className="text-xs text-muted-foreground">
                  None of these quite fit? Tell us what you&apos;re looking for in your own words.
                </div>
              </div>
            </button>
          </div>
        </BotBubble>
      )}

      {selectedServices.length > 0 && (
        <UserBubble>{selectedServices.map((s) => s.name).join(', ')}</UserBubble>
      )}

      {submitError && <BotBubble className="text-destructive">{submitError}</BotBubble>}

      {showCatalog && (
        <div className="flex justify-end pt-2">
          <Button onClick={handleContinue} disabled={selectedIds.size === 0 || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting
              ? 'Saving…'
              : reviewMode
                ? 'Save & return to review'
                : 'Continue to requirements'}
          </Button>
        </div>
      )}
    </ChatShell>
  )
}
