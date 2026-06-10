'use client'

import { useRef, useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api } from '@/lib/api'

type AccessLevel = 'INTERNAL' | 'CLIENT_VISIBLE'

interface DocItem {
  id: string
  name: string
  fileName: string
  fileSize: number
  mimeType: string
  accessLevel: AccessLevel
  createdAt: string
  uploadedBy: { firstName: string; lastName: string } | null
}

interface DocsResponse {
  documents: DocItem[]
  storageConfigured: boolean
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function extractMessage(err: unknown, fallback: string): string {
  return typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
    ? (err as { response: { data: { message: string } } }).response.data.message
    : fallback
}

const MAX_FILE_BYTES = 50 * 1024 * 1024 // keep in sync with the API

export function ProjectDocuments({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const { isAitekTeam } = useCurrentUser()
  const fileRef = useRef<HTMLInputElement>(null)
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('INTERNAL')
  const [error, setError] = useState<string | null>(null)

  const key = ['project-documents', projectId]
  const { data, isLoading } = useQuery<DocsResponse>({
    queryKey: key,
    queryFn: async () =>
      (await api.get<{ data: DocsResponse }>(`/projects/${projectId}/documents`)).data.data,
    enabled: !!projectId,
  })

  const invalidate = () => {
    setError(null)
    void queryClient.invalidateQueries({ queryKey: key })
  }

  // Single multipart POST — the file streams through the API to the VPS disk.
  const upload = useMutation({
    mutationFn: async (file: File) => {
      setError(null)
      const form = new FormData()
      form.append('file', file)
      form.append('accessLevel', accessLevel)
      await api.post(`/projects/${projectId}/documents`, form)
    },
    onSuccess: invalidate,
    onError: (err) => setError(extractMessage(err, 'Upload failed.')),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/projects/${projectId}/documents/${id}`),
    onSuccess: invalidate,
    onError: (err) => setError(extractMessage(err, 'Failed to delete document.')),
  })

  // Fetch the bytes as a blob (carries the Clerk auth header via the api
  // interceptor), then trigger a client-side download.
  const download = async (doc: DocItem) => {
    try {
      const res = await api.get(
        `/projects/${projectId}/documents/${doc.id}/download?disposition=attachment`,
        { responseType: 'blob' },
      )
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(extractMessage(err, 'Failed to download file.'))
    }
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > MAX_FILE_BYTES) {
        setError('File exceeds the 50MB limit.')
      } else {
        upload.mutate(file)
      }
    }
    e.target.value = '' // allow re-uploading the same file
  }

  const docs = data?.documents ?? []

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Documents</h3>
        </div>
        {isAitekTeam && (
          <div className="flex items-center gap-2">
            <select
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Who can see the uploaded file"
            >
              <option value="INTERNAL">Internal only</option>
              <option value="CLIENT_VISIBLE">Client-visible</option>
            </select>
            <input ref={fileRef} type="file" className="hidden" onChange={onPick} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Upload className="mr-1 h-3 w-3" />
              )}
              Upload
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{d.name}</span>
                  {isAitekTeam && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        d.accessLevel === 'CLIENT_VISIBLE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {d.accessLevel === 'CLIENT_VISIBLE' ? 'Client-visible' : 'Internal'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(d.fileSize)} · {new Date(d.createdAt).toLocaleDateString()}
                  {d.uploadedBy && ` · ${d.uploadedBy.firstName} ${d.uploadedBy.lastName}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => download(d)} title="Download">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {isAitekTeam && (
                  <button
                    onClick={() => remove.mutate(d.id)}
                    disabled={remove.isPending}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
