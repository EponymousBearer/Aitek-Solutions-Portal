'use client'

import { useEffect, useState } from 'react'

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [showCatalog, setShowCatalog] = useState(false)

  const { data: catalog, isLoading } = useQuery<CatalogCategory[]>({
    queryKey: ['service-catalog'],
    queryFn: async () => (await api.get<CatalogCategory[]>('/services')).data,
  })

  // Reveal the catalog after the bot "types" for a moment
  useEffect(() => {
    if (!isLoading) {
      const t = setTimeout(() => setShowCatalog(true), 600)
      return () => clearTimeout(t)
    }
    return undefined
  }, [isLoading])

  const toggleService = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleCategory = (id: string) => {
    setOpenCategories((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleContinue = async () => {
    if (selected.size === 0) return
    setSubmitting(true)
    try {
      await api.post('/onboarding/services', { serviceIds: Array.from(selected) })
      router.push('/onboarding/questionnaire')
    } catch (err) {
      console.error(err)
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
        Which services interest you? Pick as many as you like — your answers help us route you to
        the right team and build a focused brief.
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
                  <div className="flex flex-wrap gap-2 border-t p-3">
                    {cat.services.map((svc) => (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => toggleService(svc.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          selected.has(svc.id)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background hover:bg-muted'
                        }`}
                      >
                        {svc.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </BotBubble>
      )}

      {selected.size > 0 && (
        <UserBubble>
          Selected {selected.size} service{selected.size === 1 ? '' : 's'}
        </UserBubble>
      )}

      {showCatalog && (
        <div className="flex justify-end pt-2">
          <Button onClick={handleContinue} disabled={selected.size === 0 || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to requirements
          </Button>
        </div>
      )}
    </ChatShell>
  )
}
