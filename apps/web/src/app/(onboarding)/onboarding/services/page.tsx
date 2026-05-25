'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

import { BotBubble } from '@/components/onboarding/bot-bubble'
import { ChatShell } from '@/components/onboarding/chat-shell'
import { TypingIndicator } from '@/components/onboarding/typing-indicator'
import { UserBubble } from '@/components/onboarding/user-bubble'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)

  const { data: catalog, isLoading } = useQuery<CatalogCategory[]>({
    queryKey: ['service-catalog'],
    queryFn: async () =>
      (await api.get<{ data: CatalogCategory[] }>('/services')).data.data,
  })

  // Reveal the catalog after the bot "types" for a moment
  useEffect(() => {
    if (!isLoading) {
      const t = setTimeout(() => setShowCatalog(true), 600)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isLoading])

  const selectedService = useMemo(() => {
    if (!selectedId || !catalog) return null
    for (const cat of catalog) {
      const found = cat.services.find((s) => s.id === selectedId)
      if (found) return found
    }
    return null
  }, [selectedId, catalog])

  const toggleCategory = (id: string) => {
    setOpenCategories((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleContinue = async () => {
    if (!selectedId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post('/onboarding/services', { serviceIds: [selectedId] })
      router.push('/onboarding/questionnaire')
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

  return (
    <ChatShell currentStep="services">
      <BotBubble>
        Great &mdash; your identity is being verified. Let&apos;s talk about what we can do for you.
      </BotBubble>
      <BotBubble>
        Which service is the best fit for what you need? Pick the one that matches your project
        most closely &mdash; we&apos;ll dig into the specifics next.
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
                      const isSelected = selectedId === svc.id
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
                            type="radio"
                            name="service"
                            className="mt-0.5 h-4 w-4 accent-primary"
                            checked={isSelected}
                            onChange={() => setSelectedId(svc.id)}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{svc.name}</div>
                            {svc.description && (
                              <div className="text-xs text-muted-foreground">
                                {svc.description}
                              </div>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </BotBubble>
      )}

      {selectedService && <UserBubble>{selectedService.name}</UserBubble>}

      {submitError && (
        <BotBubble className="text-destructive">{submitError}</BotBubble>
      )}

      {showCatalog && (
        <div className="flex justify-end pt-2">
          <Button onClick={handleContinue} disabled={!selectedId || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? 'Saving…' : 'Continue to requirements'}
          </Button>
        </div>
      )}
    </ChatShell>
  )
}
