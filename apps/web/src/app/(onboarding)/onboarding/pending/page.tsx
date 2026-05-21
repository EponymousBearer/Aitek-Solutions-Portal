import type { Metadata } from 'next'

import { CheckCircle2 } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Review Pending' }

export default function PendingPage() {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <h1 className="text-xl font-semibold">Thanks — we're reviewing your submission</h1>
        <p className="text-sm text-muted-foreground">
          Our team typically reviews KYC submissions within one business day. You'll get an email
          when your portal access is ready.
        </p>
        <p className="text-xs text-muted-foreground">
          You can safely close this window — no further action is needed right now.
        </p>
      </CardContent>
    </Card>
  )
}
