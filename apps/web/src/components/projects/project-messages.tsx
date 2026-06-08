'use client'

import { useEffect, useRef, useState } from 'react'

import { useAuth } from '@clerk/nextjs'
import { Loader2, Lock, MessageSquare, Send, Trash2 } from 'lucide-react'
import { io, type Socket } from 'socket.io-client'

import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api } from '@/lib/api'

const SOCKET_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface ChatMessage {
  id: string
  senderId: string
  content: string
  isInternal: boolean
  deleted: boolean
  createdAt: string
  sender: { id: string; firstName: string; lastName: string; email: string } | null
}

function senderName(m: ChatMessage): string {
  if (!m.sender) return 'Unknown'
  const name = `${m.sender.firstName} ${m.sender.lastName}`.trim()
  if (name) return name
  // Fall back to the email's local part when the account has no name set.
  return m.sender.email ? (m.sender.email.split('@')[0] || m.sender.email) : 'Unknown'
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
}

export function ProjectMessages({ projectId }: { projectId: string }) {
  const { getToken } = useAuth()
  const { user, isAitekTeam, isAdmin } = useCurrentUser()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [connected, setConnected] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const upsert = (m: ChatMessage) =>
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id)
      if (i === -1) return [...prev, m]
      const next = [...prev]
      next[i] = m
      return next
    })

  // Initial history (REST)
  useEffect(() => {
    let active = true
    api
      .get<{ data: { messages: ChatMessage[] } }>(`/projects/${projectId}/messages`)
      .then((r) => active && setMessages(r.data.data.messages))
      .catch(() => active && setError('Failed to load messages.'))
    return () => {
      active = false
    }
  }, [projectId])

  // Realtime (Socket.io)
  useEffect(() => {
    let socket: Socket | null = null
    let cancelled = false
    void (async () => {
      const token = await getToken({ template: 'aitek-portal-default' }).catch(() => getToken())
      if (cancelled || !token) return
      socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] })
      socketRef.current = socket
      socket.on('connect', () => {
        setConnected(true)
        socket?.emit('room:join', { projectId })
      })
      socket.on('disconnect', () => setConnected(false))
      socket.on('message:new', (m: ChatMessage) => upsert(m))
      socket.on('message:deleted', (m: ChatMessage) => upsert(m))
    })()
    return () => {
      cancelled = true
      if (socket) {
        socket.emit('room:leave', { projectId })
        socket.disconnect()
      }
      socketRef.current = null
    }
  }, [projectId, getToken])

  // Auto-scroll to newest
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const send = async () => {
    const text = content.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    setContent('')
    try {
      const m = (
        await api.post<{ data: ChatMessage }>(`/projects/${projectId}/messages`, {
          content: text,
          isInternal,
        })
      ).data.data
      upsert(m) // socket also delivers; upsert dedupes
    } catch {
      setError('Failed to send message.')
      setContent(text)
    } finally {
      setSending(false)
    }
  }

  const remove = async (id: string) => {
    try {
      const m = (await api.delete<{ data: ChatMessage }>(`/projects/${projectId}/messages/${id}`))
        .data.data
      upsert(m)
    } catch {
      setError('Failed to delete message.')
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Messages</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[11px] ${connected ? 'text-emerald-600' : 'text-muted-foreground'}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
          />
          {connected ? 'Live' : 'Connecting…'}
        </span>
      </div>

      <div ref={scrollRef} className="max-h-96 min-h-[8rem] space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id
            const canDelete = !m.deleted && (mine || isAdmin)
            return (
              <div key={m.id} className="group flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{senderName(m)}</span>
                  {m.isInternal && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      <Lock className="h-2.5 w-2.5" /> Internal
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{fmtTime(m.createdAt)}</span>
                  {canDelete && (
                    <button
                      onClick={() => remove(m.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      title="Delete message"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p
                  className={`whitespace-pre-wrap rounded-lg px-3 py-1.5 text-sm ${
                    m.deleted
                      ? 'italic text-muted-foreground'
                      : m.isInternal
                        ? 'bg-amber-50 text-foreground'
                        : 'bg-muted/40 text-foreground'
                  }`}
                >
                  {m.content}
                </p>
              </div>
            )
          })
        )}
      </div>

      <div className="space-y-2 border-t border-border px-5 py-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            rows={2}
            placeholder={isInternal ? 'Internal note (team only)…' : 'Write a message…'}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button size="sm" onClick={() => void send()} disabled={sending || !content.trim()}>
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </Button>
        </div>
        {isAitekTeam && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Internal note — visible to the AiTek team only
          </label>
        )}
      </div>
    </div>
  )
}
