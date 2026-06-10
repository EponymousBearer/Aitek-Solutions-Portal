'use client'

import { useState } from 'react'

import Link from 'next/link'

import type { KYCDocumentCategory } from '@aitek/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Eye, FileText, Loader2, RotateCcw, ShieldCheck } from 'lucide-react'

import { kycCategoryLabel } from '@/components/onboarding/onboarding-summary'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface KycDoc {
  id: string
  category: KYCDocumentCategory
  fileName: string
  fileSize: number
  status: string
}

interface KycSubmission {
  id: string
  status: string
  submittedAt: string
  resubmissionCount: number
  reviewNotes: string | null
  documents: KycDoc[]
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

export default function AdminKYCPage() {
  const queryClient = useQueryClient()
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<KycSubmission[]>({
    queryKey: ['admin-kyc-submissions'],
    queryFn: async () =>
      (await api.get<{ data: KycSubmission[] }>('/kyc/submissions')).data.data,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-kyc-submissions'] })

  // Fetch the document as a blob (carries the Clerk token via the api
  // interceptor) and open it in a new tab.
  const viewDocument = async (id: string) => {
    setErrorMessage(null)
    try {
      const res = await api.get(`/kyc/documents/${id}/download?disposition=inline`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data as Blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setErrorMessage(extractMessage(err, 'Failed to open document.'))
    }
  }

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      setErrorMessage(null)
      await api.post(`/kyc/submissions/${id}/approve`)
    },
    onSuccess: () => void invalidate(),
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to approve.')),
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reviewNotes }: { id: string; reviewNotes: string }) => {
      setErrorMessage(null)
      await api.post(`/kyc/submissions/${id}/reject`, { notes: reviewNotes || undefined })
    },
    onSuccess: () => {
      setRejectingId(null)
      setNotes('')
      void invalidate()
    },
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to request resubmission.')),
  })

  const busyId =
    (approveMutation.isPending ? approveMutation.variables : null) ??
    (rejectMutation.isPending ? rejectMutation.variables?.id : null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">KYC review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Identity-verification submissions awaiting review. Approve to clear KYC, or request a
          resubmission to send the documents back for changes.
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
          Failed to load submissions.
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background py-12 text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No submissions to review</p>
          <p className="text-xs text-muted-foreground">
            Submitted identity documents appear here for review.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {data?.map((s) => {
          const contact = s.company.memberships[0]?.user
          const isBusy = busyId === s.id
          return (
            <div key={s.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link
                    href={`/admin/clients/${s.company.id}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {s.company.name}
                  </Link>
                  {contact && (
                    <p className="text-xs text-muted-foreground">
                      {contact.firstName} {contact.lastName} · {contact.email}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Submitted {new Date(s.submittedAt).toLocaleDateString()}
                  </p>
                  {s.resubmissionCount > 0 && (
                    <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Resubmission #{s.resubmissionCount}
                    </span>
                  )}
                </div>
              </div>

              {/* Documents */}
              <ul className="mt-3 space-y-1.5">
                {s.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-foreground">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="shrink-0">{kycCategoryLabel(doc.category)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        · {doc.fileName} · {(doc.fileSize / 1024).toFixed(1)} KB
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => viewDocument(doc.id)}
                    >
                      <Eye className="mr-1 h-3 w-3" /> View
                    </Button>
                  </li>
                ))}
              </ul>

              {/* Actions */}
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRejectingId(rejectingId === s.id ? null : s.id)
                      setNotes('')
                    }}
                    disabled={isBusy}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" /> Request resubmission
                  </Button>
                  <Button size="sm" onClick={() => approveMutation.mutate(s.id)} disabled={isBusy}>
                    {approveMutation.isPending && approveMutation.variables === s.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    )}
                    Approve
                  </Button>
                </div>
                {rejectingId === s.id && (
                  <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional note to the client (what needs fixing)…"
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRejectingId(null)}
                        disabled={isBusy}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => rejectMutation.mutate({ id: s.id, reviewNotes: notes })}
                        disabled={isBusy}
                      >
                        {rejectMutation.isPending ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        Send back to client
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
