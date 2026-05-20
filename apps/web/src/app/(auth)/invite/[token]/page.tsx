'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'

interface InviteDetails {
  email: string
  companyId?: string
  role: string
  type: string
}

export default function InvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const { isSignedIn, getToken } = useAuth()

  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await api.get<{ data: InviteDetails }>(`/auth/invite/${params.token}`)
        setInvite(res.data.data)
      } catch {
        setError('This invite link is invalid or has expired.')
      } finally {
        setLoading(false)
      }
    }
    void fetchInvite()
  }, [params.token])

  const handleAccept = async () => {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`)
      return
    }

    setAccepting(true)
    try {
      const token = await getToken()
      await api.post(
        `/auth/invite/${params.token}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setAccepted(true)
      setTimeout(() => router.push('/portal'), 2000)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to accept invite. Please try again.'
      setError(msg)
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error && !invite) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="font-medium text-destructive">Invalid invite</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => router.push('/sign-in')}>
            Go to Sign In
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (accepted) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle className="h-10 w-10 text-green-500" />
          <p className="font-semibold">Invite accepted!</p>
          <p className="text-sm text-muted-foreground">Redirecting you to the portal…</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>You have been invited</CardTitle>
        <CardDescription>
          {invite?.type === 'company_invite'
            ? 'You have been invited to join a company on AiTek Portal.'
            : 'You have been invited to join the AiTek Portal team.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Invite sent to: </span>
          <span className="font-medium">{invite?.email}</span>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {isSignedIn ? (
          <Button className="w-full" onClick={handleAccept} disabled={accepting}>
            {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Accept Invite
          </Button>
        ) : (
          <div className="space-y-2">
            <Button className="w-full" onClick={handleAccept}>
              Sign in to accept
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                router.push(`/sign-up?redirect_url=${encodeURIComponent(window.location.href)}`)
              }
            >
              Create account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
