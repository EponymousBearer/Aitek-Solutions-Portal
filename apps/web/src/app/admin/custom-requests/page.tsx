'use client'

import { useState } from 'react'

import Link from 'next/link'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Paperclip, Sparkles, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface CustomRequest {
  id: string
  description: string
  goals: string | null
  budget: string | null
  timeline: string | null
  fileKeys: string[]
  status: string
  createdAt: string
  company: {
    id: string
    name: string
    memberships: { user: { email: string; firstName: string; lastName: string } }[]
  }
}

function extractMessage(err: unknown, fallback: string): string {
  return typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
    ? (err as { response: { data: { message: string } } }).response.data.message
    : fallback
}

export default function AdminCustomRequestsPage() {
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<CustomRequest[]>({
    queryKey: ['admin-custom-requests'],
    queryFn: async () => (await api.get<{ data: CustomRequest[] }>('/custom-requests')).data.data,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-custom-requests'] })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      setErrorMessage(null)
      await api.post(`/custom-requests/${id}/approve`)
    },
    onSuccess: () => void invalidate(),
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to approve.')),
  })

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      setErrorMessage(null)
      await api.post(`/custom-requests/${id}/reject`)
    },
    onSuccess: () => void invalidate(),
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to reject.')),
  })

  const busyId =
    (approveMutation.isPending ? approveMutation.variables : null) ??
    (rejectMutation.isPending ? rejectMutation.variables : null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Custom requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          &ldquo;Something else&rdquo; requests from clients who didn&apos;t pick a standard service.
          Approve to greenlight, or reject to decline.
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
          Failed to load custom requests.
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background py-12 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No custom requests to review</p>
          <p className="text-xs text-muted-foreground">
            Requests from the &ldquo;Something else&rdquo; flow appear here for review.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {data?.map((r) => {
          const contact = r.company.memberships[0]?.user
          const isBusy = busyId === r.id
          return (
            <div key={r.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/admin/clients/${r.company.id}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {r.company.name}
                  </Link>
                  {contact && (
                    <p className="text-xs text-muted-foreground">
                      {contact.firstName} {contact.lastName} · {contact.email}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">What they&apos;re looking for</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-foreground">{r.description}</p>
                </div>
                {r.goals && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Goals</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-foreground">{r.goals}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  <span>
                    <span className="text-muted-foreground">Budget:</span>{' '}
                    <span className="text-foreground">{r.budget || '—'}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Timeline:</span>{' '}
                    <span className="text-foreground">{r.timeline || '—'}</span>
                  </span>
                </div>
                {r.fileKeys.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {r.fileKeys.map((name) => (
                      <li
                        key={name}
                        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground"
                      >
                        <Paperclip className="h-3 w-3 text-muted-foreground" /> {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rejectMutation.mutate(r.id)}
                  disabled={isBusy}
                >
                  {rejectMutation.isPending && rejectMutation.variables === r.id ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <XCircle className="mr-1 h-3 w-3" />
                  )}
                  Reject
                </Button>
                <Button size="sm" onClick={() => approveMutation.mutate(r.id)} disabled={isBusy}>
                  {approveMutation.isPending && approveMutation.variables === r.id ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
