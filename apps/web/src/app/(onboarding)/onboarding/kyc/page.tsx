'use client'

import { useEffect, useRef, useState } from 'react'

import { useRouter } from 'next/navigation'

import { KYCDocumentCategory, KYCStatus } from '@aitek/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, FileText, Loader2, Upload } from 'lucide-react'

import { BotBubble } from '@/components/onboarding/bot-bubble'
import { ChatShell } from '@/components/onboarding/chat-shell'
import { TypingIndicator } from '@/components/onboarding/typing-indicator'
import { UserBubble } from '@/components/onboarding/user-bubble'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

interface KycDoc {
  id: string
  category: KYCDocumentCategory
  fileName: string
  fileSize: number
  mimeType: string
}

interface KycSubmission {
  id: string
  status: KYCStatus
  documents: KycDoc[]
}

const REQUIRED_CATEGORIES: { category: KYCDocumentCategory; label: string; help: string }[] = [
  {
    category: KYCDocumentCategory.BUSINESS_REGISTRATION,
    label: 'Business registration',
    help: 'Articles of incorporation, certificate of formation, or equivalent.',
  },
  {
    category: KYCDocumentCategory.TAX_ID,
    label: 'Tax ID / EIN / GST',
    help: 'Tax identification document for your company.',
  },
  {
    category: KYCDocumentCategory.GOVERNMENT_ID,
    label: 'Government ID',
    help: 'Photo ID of the owner or authorized signer.',
  },
  {
    category: KYCDocumentCategory.ADDRESS_PROOF,
    label: 'Proof of address',
    help: 'Recent utility bill, bank statement, or lease (within 90 days).',
  },
]

export default function KycPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [uploadingCategory, setUploadingCategory] = useState<KYCDocumentCategory | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showUploads, setShowUploads] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const { data: submission } = useQuery<KycSubmission | null>({
    queryKey: ['kyc-me'],
    queryFn: async () => (await api.get<KycSubmission | null>('/kyc/me')).data,
  })

  useEffect(() => {
    const t = setTimeout(() => setShowUploads(true), 500)
    return () => clearTimeout(t)
  }, [])

  const uploadedSet = new Set((submission?.documents ?? []).map((d) => d.category))
  const allRequiredUploaded = REQUIRED_CATEGORIES.every((c) => uploadedSet.has(c.category))
  const alreadySubmitted =
    submission?.status === KYCStatus.UNDER_REVIEW ||
    submission?.status === KYCStatus.APPROVED ||
    submission?.status === KYCStatus.REJECTED

  const triggerPicker = (category: KYCDocumentCategory) => {
    inputRefs.current[category]?.click()
  }

  const handleFile = async (category: KYCDocumentCategory, file: File) => {
    setUploadingCategory(category)
    try {
      await api.post('/kyc/me/documents', {
        category,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      })
      await queryClient.invalidateQueries({ queryKey: ['kyc-me'] })
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingCategory(null)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await api.post('/kyc/me/submit')
      await queryClient.invalidateQueries({ queryKey: ['current-user'] })
      router.push('/onboarding/services')
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (alreadySubmitted) {
    return (
      <ChatShell currentStep="kyc">
        <BotBubble>
          Your identity verification is in review. We'll take it from here — you can continue to
          the next step.
        </BotBubble>
        <div className="flex justify-end pt-2">
          <Button onClick={() => router.push('/onboarding/services')}>Continue</Button>
        </div>
      </ChatShell>
    )
  }

  return (
    <ChatShell currentStep="kyc">
      <BotBubble>
        Nice — your company profile is saved. Before we open the portal, we need to verify your
        business identity. It's quick.
      </BotBubble>

      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong>Stub mode (dev):</strong> file content is discarded after upload — only the
        filename + size are stored. Real R2 upload lands in Prompt 6.
      </div>

      {!showUploads && <TypingIndicator />}

      {showUploads && (
        <BotBubble className="!max-w-full">
          <div className="w-full space-y-2">
            {REQUIRED_CATEGORIES.map((cat) => {
              const uploaded = submission?.documents.find((d) => d.category === cat.category)
              const isUploading = uploadingCategory === cat.category
              return (
                <div
                  key={cat.category}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-md ${
                        uploaded ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {uploaded ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {cat.label}
                      </div>
                      {uploaded ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {uploaded.fileName} · {(uploaded.fileSize / 1024).toFixed(1)} KB
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">{cat.help}</div>
                      )}
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    ref={(el) => {
                      inputRefs.current[cat.category] = el
                    }}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleFile(cat.category, file)
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={uploaded ? 'outline' : 'default'}
                    disabled={isUploading}
                    onClick={() => triggerPicker(cat.category)}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Upload className="mr-1 h-3 w-3" />
                        {uploaded ? 'Replace' : 'Upload'}
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </BotBubble>
      )}

      {allRequiredUploaded && (
        <>
          <UserBubble>All four documents uploaded</UserBubble>
          <BotBubble>Submit for review and we'll take it from here.</BotBubble>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit for review
            </Button>
          </div>
        </>
      )}
    </ChatShell>
  )
}
