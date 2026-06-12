'use client'

import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Package,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'

type DeliverableStatus = 'PENDING' | 'DELIVERED'

interface DeliverableFile {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  createdAt: string
}

interface Deliverable {
  id: string
  title: string
  description: string | null
  url: string | null
  status: DeliverableStatus
  deliveredAt: string | null
  createdAt: string
  files: DeliverableFile[]
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

interface DeliverablesResponse {
  deliverables: Deliverable[]
  canManage: boolean
}

function extractMessage(err: unknown, fallback: string): string {
  return typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
    ? (err as { response: { data: { message: string } } }).response.data.message
    : fallback
}

export function ProjectDeliverables({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ mode: 'create' } | { mode: 'edit'; item: Deliverable } | null>(
    null,
  )

  const queryKey = ['project-deliverables', projectId]
  const { data, isLoading } = useQuery<DeliverablesResponse>({
    queryKey,
    queryFn: async () =>
      (await api.get<{ data: DeliverablesResponse }>(`/projects/${projectId}/deliverables`)).data
        .data,
    enabled: !!projectId,
  })

  const invalidate = () => {
    setError(null)
    void queryClient.invalidateQueries({ queryKey })
  }

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DeliverableStatus }) =>
      api.patch(`/projects/${projectId}/deliverables/${id}`, { status }),
    onSuccess: invalidate,
    onError: (err) => setError(extractMessage(err, 'Failed to update deliverable.')),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/projects/${projectId}/deliverables/${id}`),
    onSuccess: invalidate,
    onError: (err) => setError(extractMessage(err, 'Failed to delete deliverable.')),
  })

  const removeFile = useMutation({
    mutationFn: async ({ deliverableId, fileId }: { deliverableId: string; fileId: string }) =>
      api.delete(`/projects/${projectId}/deliverables/${deliverableId}/files/${fileId}`),
    onSuccess: invalidate,
    onError: (err) => setError(extractMessage(err, 'Failed to remove file.')),
  })

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const downloadFile = async (deliverableId: string, file: DeliverableFile) => {
    setError(null)
    setDownloadingId(file.id)
    try {
      const res = await api.get(
        `/projects/${projectId}/deliverables/${deliverableId}/files/${file.id}/download`,
        { responseType: 'blob' },
      )
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(extractMessage(err, 'Failed to download file.'))
    } finally {
      setDownloadingId(null)
    }
  }

  const items = data?.deliverables ?? []
  const canManage = data?.canManage ?? false

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Deliverables</h3>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setDialog({ mode: 'create' })}>
            <Plus className="mr-1 h-3 w-3" /> Add deliverable
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deliverables yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {items.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{d.title}</span>
                  <Badge variant={d.status === 'DELIVERED' ? 'success' : 'secondary'}>
                    {d.status === 'DELIVERED' ? 'Delivered' : 'Pending'}
                  </Badge>
                </div>
                {d.description && (
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                    {d.description}
                  </p>
                )}
                {d.url && (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                )}
                {d.files.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {d.files.map((f) => (
                      <li key={f.id} className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => downloadFile(d.id, f)}
                          disabled={downloadingId === f.id}
                          className="inline-flex min-w-0 items-center gap-1.5 font-medium text-primary hover:underline disabled:opacity-60"
                        >
                          {downloadingId === f.id ? (
                            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                          ) : (
                            <FileText className="h-3 w-3 shrink-0" />
                          )}
                          <span className="truncate">{f.fileName}</span>
                          <Download className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </button>
                        <span className="shrink-0 text-muted-foreground">
                          {formatBytes(f.fileSize)}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => removeFile.mutate({ deliverableId: d.id, fileId: f.id })}
                            disabled={removeFile.isPending}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            title="Remove file"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    title={d.status === 'DELIVERED' ? 'Mark as pending' : 'Mark as delivered'}
                    disabled={setStatus.isPending}
                    onClick={() =>
                      setStatus.mutate({
                        id: d.id,
                        status: d.status === 'DELIVERED' ? 'PENDING' : 'DELIVERED',
                      })
                    }
                  >
                    {d.status === 'DELIVERED' ? (
                      <RotateCcw className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Edit"
                    onClick={() => setDialog({ mode: 'edit', item: d })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <button
                    onClick={() => remove.mutate(d.id)}
                    disabled={remove.isPending}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {dialog && (
        <DeliverableDialog
          projectId={projectId}
          existing={dialog.mode === 'edit' ? dialog.item : null}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            invalidate()
          }}
        />
      )}
    </div>
  )
}

function DeliverableDialog({
  projectId,
  existing,
  onClose,
  onSaved,
}: {
  projectId: string
  existing: Deliverable | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [url, setUrl] = useState(existing?.url ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.append('title', title)
      form.append('description', description || '')
      form.append('url', url || '')
      files.forEach((f) => form.append('files', f))
      if (existing) {
        await api.patch(`/projects/${projectId}/deliverables/${existing.id}`, form)
      } else {
        await api.post(`/projects/${projectId}/deliverables`, form)
      }
    },
    onSuccess: onSaved,
    onError: (err) => setError(extractMessage(err, 'Failed to save deliverable.')),
  })

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list)])
  }

  const canSubmit = title.trim() && !save.isPending

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit deliverable' : 'New deliverable'}</DialogTitle>
          <DialogDescription>This is visible to the client on the project page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="dlv-title">Title</Label>
            <Input
              id="dlv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Brand style guide"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dlv-desc">Description (optional)</Label>
            <Textarea
              id="dlv-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What this deliverable is…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dlv-url">Link (optional)</Label>
            <Input
              id="dlv-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dlv-files">
              {existing ? 'Attach more files (optional)' : 'Attach files (optional)'}
            </Label>
            <input
              id="dlv-files"
              type="file"
              multiple
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
            />
            <p className="text-[11px] text-muted-foreground">
              Up to 10 files, 50MB each. The client can download them on the project page.
            </p>
            {files.length > 0 && (
              <ul className="mt-1 space-y-1">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs"
                  >
                    <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-foreground">{f.name}</span>
                    <span className="shrink-0 text-muted-foreground">{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!canSubmit}>
            {save.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {existing ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
