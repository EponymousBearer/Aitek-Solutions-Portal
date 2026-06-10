'use client'

import { useState } from 'react'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileSignature, FileText, Loader2, PenLine, Plus, Trash2 } from 'lucide-react'

import { SignaturePad } from '@/components/agreements/signature-pad'
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
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { api } from '@/lib/api'

type AgreementStatus =
  | 'DRAFT'
  | 'PENDING_ACKNOWLEDGMENT'
  | 'ACKNOWLEDGED'
  | 'REJECTED'
  | 'EXPIRED'

interface AuditRecord {
  id: string
  acknowledgedName: string
  signatureImage: string | null
  documentHash: string
  ipAddress: string
  userAgent: string
  acknowledgedAt: string
  user: { id: string; firstName: string; lastName: string } | null
}

export interface Agreement {
  id: string
  companyId: string
  projectId: string | null
  title: string
  description: string | null
  body: string | null
  status: AgreementStatus
  createdAt: string
  sentAt: string | null
  expiresAt: string | null
  company: { id: string; name: string } | null
  project: { id: string; name: string } | null
  document: { id: string; fileName: string; mimeType: string } | null
  auditRecords: AuditRecord[]
}

function extractMessage(err: unknown, fallback: string): string {
  return typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { data?: { message?: string } } }).response?.data?.message
    ? (err as { response: { data: { message: string } } }).response.data.message
    : fallback
}

function StatusBadge({ status }: { status: AgreementStatus }) {
  const map: Record<AgreementStatus, { label: string; variant: 'secondary' | 'warning' | 'success' | 'destructive' | 'outline' }> = {
    DRAFT: { label: 'Draft', variant: 'secondary' },
    PENDING_ACKNOWLEDGMENT: { label: 'Awaiting signature', variant: 'warning' },
    ACKNOWLEDGED: { label: 'Signed', variant: 'success' },
    REJECTED: { label: 'Rejected', variant: 'destructive' },
    EXPIRED: { label: 'Expired', variant: 'outline' },
  }
  const s = map[status]
  return <Badge variant={s.variant}>{s.label}</Badge>
}

// Fetches the attached PDF as a blob (carries the Clerk token via the api
// interceptor) and opens it in a new tab.
function ViewPdfButton({ agreementId }: { agreementId: string }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const open = async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await api.get(`/agreements/${agreementId}/document?disposition=inline`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data as Blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setErr(extractMessage(e, 'Failed to open the file.'))
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" size="sm" onClick={open} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <FileText className="mr-1 h-3 w-3" />
        )}
        View attached PDF
      </Button>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  )
}

export function AgreementsPanel({
  projectId,
  heading = 'Agreements',
  showProject = false,
}: {
  projectId?: string
  heading?: string
  showProject?: boolean
}) {
  const queryClient = useQueryClient()
  const { isAitekTeam } = useCurrentUser()
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [signing, setSigning] = useState<Agreement | null>(null)
  const [viewing, setViewing] = useState<Agreement | null>(null)

  const queryKey = ['agreements', projectId ?? 'all']
  const { data, isLoading } = useQuery<Agreement[]>({
    queryKey,
    queryFn: async () =>
      (
        await api.get<{ data: Agreement[] }>(
          projectId ? `/agreements?projectId=${projectId}` : '/agreements',
        )
      ).data.data,
  })

  const invalidate = () => {
    setError(null)
    void queryClient.invalidateQueries({ queryKey })
  }

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/agreements/${id}`),
    onSuccess: invalidate,
    onError: (err) => setError(extractMessage(err, 'Failed to delete agreement.')),
  })

  const agreements = data ?? []

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
        </div>
        {isAitekTeam && projectId && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-3 w-3" /> New agreement
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : agreements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agreements yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {agreements.map((a) => {
            const signed = a.auditRecords[0]
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{a.title}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {showProject && a.project && <>{a.project.name} · </>}
                    {showProject && a.company && <>{a.company.name} · </>}
                    {signed
                      ? `Signed by ${signed.acknowledgedName} on ${new Date(signed.acknowledgedAt).toLocaleDateString()}`
                      : `Sent ${new Date(a.sentAt ?? a.createdAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!isAitekTeam && a.status === 'PENDING_ACKNOWLEDGMENT' ? (
                    <Button size="sm" onClick={() => setSigning(a)}>
                      <PenLine className="mr-1 h-3 w-3" /> Review &amp; sign
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setViewing(a)}>
                      View
                    </Button>
                  )}
                  {isAitekTeam && a.status !== 'ACKNOWLEDGED' && (
                    <button
                      onClick={() => remove.mutate(a.id)}
                      disabled={remove.isPending}
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {createOpen && projectId && (
        <CreateDialog
          projectId={projectId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false)
            invalidate()
          }}
        />
      )}
      {signing && (
        <SignDialog
          agreement={signing}
          onClose={() => setSigning(null)}
          onSigned={() => {
            setSigning(null)
            invalidate()
          }}
        />
      )}
      {viewing && (
        <ViewDialog agreement={viewing} isAitek={isAitekTeam} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}

function CreateDialog({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [body, setBody] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const form = new FormData()
      form.append('projectId', projectId)
      form.append('title', title)
      if (description) form.append('description', description)
      if (body) form.append('body', body)
      if (expiresAt) form.append('expiresAt', expiresAt)
      if (file) form.append('file', file)
      await api.post('/agreements', form)
    },
    onSuccess: onCreated,
    onError: (err) => setError(extractMessage(err, 'Failed to create agreement.')),
  })

  const canSubmit = title.trim() && (body.trim() || file) && !create.isPending

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New agreement</DialogTitle>
          <DialogDescription>
            The client will be notified and asked to read and sign it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ag-title">Title</Label>
            <Input
              id="ag-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master Services Agreement"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ag-desc">Short description (optional)</Label>
            <Input
              id="ag-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A one-line summary"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ag-body">Agreement text {file && <span className="text-muted-foreground">(optional — PDF attached)</span>}</Label>
            <Textarea
              id="ag-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={file ? 4 : 10}
              placeholder="Paste or write the full agreement the client will read and sign…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ag-file">Attach a PDF (optional)</Label>
            <input
              id="ag-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
            />
            <p className="text-[11px] text-muted-foreground">
              The client reads the PDF and signs it. You can provide text, a PDF, or both.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ag-exp">Expires (optional)</Label>
            <Input
              id="ag-exp"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!canSubmit}>
            {create.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Send to client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SignDialog({
  agreement,
  onClose,
  onSigned,
}: {
  agreement: Agreement
  onClose: () => void
  onSigned: () => void
}) {
  const [signerName, setSignerName] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sign = useMutation({
    mutationFn: async () =>
      api.post(`/agreements/${agreement.id}/sign`, {
        signerName,
        signatureImage: signature,
      }),
    onSuccess: onSigned,
    onError: (err) => setError(extractMessage(err, 'Failed to submit signature.')),
  })

  const canSubmit = signerName.trim() && signature && !sign.isPending

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{agreement.title}</DialogTitle>
          {agreement.description && <DialogDescription>{agreement.description}</DialogDescription>}
        </DialogHeader>

        {agreement.document && <ViewPdfButton agreementId={agreement.id} />}
        {agreement.body && (
          <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
            {agreement.body}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sign-name">Full legal name</Label>
            <Input
              id="sign-name"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Type your full name"
            />
          </div>
          <div className="space-y-1">
            <Label>Signature</Label>
            <SignaturePad onChange={setSignature} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            By signing, you acknowledge that you have read and agree to this agreement. Your name,
            signature, date, and IP address are recorded.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={sign.isPending}>
            Cancel
          </Button>
          <Button onClick={() => sign.mutate()} disabled={!canSubmit}>
            {sign.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Agree &amp; sign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ViewDialog({
  agreement,
  isAitek,
  onClose,
}: {
  agreement: Agreement
  isAitek: boolean
  onClose: () => void
}) {
  const signed = agreement.auditRecords[0]
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {agreement.title} <StatusBadge status={agreement.status} />
          </DialogTitle>
          {agreement.description && <DialogDescription>{agreement.description}</DialogDescription>}
        </DialogHeader>

        {agreement.document && <ViewPdfButton agreementId={agreement.id} />}
        {agreement.body && (
          <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
            {agreement.body}
          </div>
        )}

        {signed ? (
          <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <p className="font-medium text-emerald-800">
              Signed by {signed.acknowledgedName} on{' '}
              {new Date(signed.acknowledgedAt).toLocaleString()}
            </p>
            {signed.signatureImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signed.signatureImage}
                alt="Signature"
                className="h-24 w-auto rounded border border-emerald-200 bg-white"
              />
            )}
            {isAitek && (
              <div className="space-y-0.5 pt-1 text-[11px] text-emerald-700">
                <p>IP: {signed.ipAddress}</p>
                <p className="truncate">Device: {signed.userAgent}</p>
                <p className="truncate">Integrity hash: {signed.documentHash}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not yet signed.</p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
