'use client'

import { useEffect, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { Loader2, MessageSquare } from 'lucide-react'

import { ProjectMessages } from '@/components/projects/project-messages'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ConversationProject {
  id: string
  name: string
  company: { id: string; name: string }
}

// A messages "inbox": the left pane lists the projects you can see (each project
// is one conversation), the right pane is that project's chat. Reuses the same
// ProjectMessages component used on the project detail pages.
export function MessagesInbox() {
  const [selected, setSelected] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<ConversationProject[]>({
    queryKey: ['messages-projects'],
    queryFn: async () =>
      (await api.get<{ data: ConversationProject[] }>('/projects')).data.data,
  })

  // Auto-open the first conversation.
  useEffect(() => {
    if (!selected && data && data.length > 0) setSelected(data[0]!.id)
  }, [data, selected])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One conversation per project. Pick a project to chat.
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Conversation list */}
        <div className="w-full shrink-0 overflow-hidden rounded-xl border border-border bg-background md:w-72">
          {isLoading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="px-4 py-6 text-sm text-destructive">Failed to load conversations.</div>
          ) : !data || data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No conversations</p>
              <p className="text-xs text-muted-foreground">
                Messages appear here once you’re on a project.
              </p>
            </div>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto md:max-h-[34rem]">
              {data.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-accent',
                      selected === p.id && 'bg-primary/10',
                    )}
                  >
                    <span className="line-clamp-1 text-sm font-medium text-foreground">{p.name}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {p.company.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Active conversation */}
        <div className="min-w-0 flex-1">
          {selected ? (
            <ProjectMessages key={selected} projectId={selected} />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a conversation to start chatting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
