import type { Metadata } from 'next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Sign In' }

export default function SignInPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your AiTek Portal account</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Clerk <SignIn /> component added in Prompt 5 */}
        <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          Clerk SignIn component — configured in Prompt 5
        </div>
      </CardContent>
    </Card>
  )
}
