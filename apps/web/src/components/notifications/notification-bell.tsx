'use client'

import { useEffect, useRef, useState } from 'react'

import { useRouter } from 'next/navigation'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Loader2 } from 'lucide-react'

import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api } from '@/lib/api'
import { homePathFor } from '@/lib/internal-routes'
import { cn } from '@/lib/utils'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  data: { projectId?: string } | null
  isRead: boolean
  createdAt: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function NotificationBell() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Unread count — polled so the badge stays fresh without a socket.
  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ['notifications-unread'],
    queryFn: async () =>
      (await api.get<{ data: { count: number } }>('/notifications/unread-count')).data.data,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })
  const unread = countData?.count ?? 0

  // List — loaded when the panel opens.
  const { data: listData, isLoading } = useQuery<{ notifications: NotificationItem[] }>({
    queryKey: ['notifications-list'],
    queryFn: async () =>
      (await api.get<{ data: { notifications: NotificationItem[] } }>('/notifications?limit=15')).data
        .data,
    enabled: open,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
  }

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: refresh,
  })
  const markAll = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: refresh,
  })

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const openNotification = (n: NotificationItem) => {
    if (!n.isRead) markRead.mutate(n.id)
    setOpen(false)
    const base = homePathFor(user)
    if (n.data?.projectId) router.push(`${base}/projects/${n.data.projectId}`)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-primary hover:underline"
                disabled={markAll.isPending}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : !listData || listData.notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                You’re all caught up.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {listData.notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => openNotification(n)}
                      className={cn(
                        'flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left hover:bg-accent',
                        !n.isRead && 'bg-primary/5',
                      )}
                    >
                      <div className="flex w-full items-center gap-2">
                        {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                        <span className="line-clamp-1 text-sm font-medium text-foreground">
                          {n.title}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <span className="line-clamp-2 pl-3.5 text-xs text-muted-foreground">
                        {n.body}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
