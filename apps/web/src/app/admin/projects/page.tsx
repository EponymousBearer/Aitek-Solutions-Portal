'use client'

import { useState } from 'react'

import Link from 'next/link'

import type { ProjectStatus } from '@aitek/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderKanban, Loader2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { PROJECT_STATUS_LABELS, projectProgress, projectStatusBadgeClass } from '@/lib/project'

interface AdminProject {
  id: string
  name: string
  status: ProjectStatus
  createdAt: string
  company: { id: string; name: string }
}

interface CompanyOption {
  id: string
  name: string
}

function extractMessage(err: unknown, fallback: string): string {
  return typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
    ? (err as { response: { data: { message: string } } }).response.data.message
    : fallback
}

export default function AdminProjectsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [companyId, setCompanyId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<AdminProject[]>({
    queryKey: ['admin-projects'],
    queryFn: async () => (await api.get<{ data: AdminProject[] }>('/projects')).data.data,
  })

  // Company picker for the "New project" form.
  const { data: companies } = useQuery<CompanyOption[]>({
    queryKey: ['admin-onboarding-clients'],
    queryFn: async () =>
      (await api.get<{ data: CompanyOption[] }>('/companies/onboarding')).data.data,
    enabled: showForm,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null)
      await api.post('/projects', { companyId, name, description: description || undefined })
    },
    onSuccess: () => {
      setShowForm(false)
      setCompanyId('')
      setName('')
      setDescription('')
      void queryClient.invalidateQueries({ queryKey: ['admin-projects'] })
    },
    onError: (err) => setErrorMessage(extractMessage(err, 'Failed to create project.')),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every client engagement. A project is created automatically when you approve a client;
            add more here as needed.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((s) => !s)}>
          <Plus className="mr-1 h-3 w-3" /> New project
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Client</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a client…</option>
                {companies?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Project name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Patient portal build" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of the engagement"
            />
          </div>
          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !companyId || !name.trim()}
            >
              {createMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Create project
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Failed to load projects.
        </div>
      )}

      {!isLoading && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background py-12 text-center">
          <FolderKanban className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No projects yet</p>
          <p className="text-xs text-muted-foreground">
            Approve a client (or use “New project”) to create one.
          </p>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Project</th>
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Progress</th>
                <th className="px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => {
                const progress = projectProgress(p.status)
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/projects/${p.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/clients/${p.company.id}`}
                        className="text-foreground hover:underline"
                      >
                        {p.company.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${projectStatusBadgeClass(p.status)}`}
                      >
                        {PROJECT_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{progress.percent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
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
