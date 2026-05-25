'use client'

import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface PendingMembership {
  user: { id: string; email: string; firstName: string; lastName: string }
}

interface PendingCompany {
  id: string
  name: string
  industry: string | null
  businessType: string | null
  country: string | null
  state: string | null
  website: string | null
  kycStatus: string
  createdAt: string
  memberships: PendingMembership[]
  _count: { selectedServices: number }
}

export default function AdminClientsPage() {
  const queryClient = useQueryClient()
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<PendingCompany[]>({
    queryKey: ['admin-pending-companies'],
    queryFn: async () =>
      (await api.get<{ data: PendingCompany[] }>('/companies/pending')).data.data,
  })

  const approveMutation = useMutation({
    mutationFn: async (companyId: string) => {
      setApprovingId(companyId)
      setErrorMessage(null)
      try {
        await api.post(`/companies/${companyId}/approve`)
      } finally {
        setApprovingId(null)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-pending-companies'] })
    },
    onError: (err) => {
      const msg =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message
          ? (err as { response: { data: { message: string } } }).response.data.message
          : 'Failed to approve.'
      setErrorMessage(msg)
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pending approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Companies that have finished onboarding and are waiting for an AiTek team approval to
          access the portal.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Failed to load pending companies.
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No pending approvals</p>
          <p className="text-xs text-muted-foreground">
            Companies awaiting approval will appear here after they finish onboarding.
          </p>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Primary contact</th>
                <th className="px-4 py-2.5">Industry</th>
                <th className="px-4 py-2.5">Services</th>
                <th className="px-4 py-2.5">KYC</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => {
                const contact = c.memberships[0]?.user
                const isApproving = approvingId === c.id
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[c.state, c.country].filter(Boolean).join(', ') || '—'}
                      </div>
                      {c.website && (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {c.website}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {contact ? (
                        <>
                          <div className="text-foreground">
                            {contact.firstName} {contact.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">{contact.email}</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-foreground">
                      {c.industry || '—'}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-foreground">
                      {c._count.selectedServices}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {c.kycStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(c.id)}
                        disabled={isApproving}
                      >
                        {isApproving ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Approving…
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
