'use client'

import { useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import { useClerk } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'

export function TokenSignIn({ token }: { token: string }) {
  const clerk = useClerk()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clerk.client) return

    const run = async () => {
      try {
        const res = await clerk.client!.signIn.create({ strategy: 'ticket', ticket: token })
        if (res.status === 'complete') {
          await clerk.setActive({ session: res.createdSessionId })
          router.replace('/portal')
        } else {
          setError('Sign-in incomplete. Try again.')
        }
      } catch {
        setError('Invalid or expired token.')
      }
    }

    void run()
  }, [clerk, token, router])

  if (error) {
    return <div className="text-center text-sm text-destructive">{error}</div>
  }

  return (
    <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      Signing you in…
    </div>
  )
}
