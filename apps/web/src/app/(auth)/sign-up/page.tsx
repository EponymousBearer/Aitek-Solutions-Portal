import type { Metadata } from 'next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Create Account' }

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start your AiTek Portal onboarding</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Clerk <SignUp /> component added in Prompt 5 */}
        <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
          Clerk SignUp component — configured in Prompt 5
        </div>
      </CardContent>
    </Card>
  )
}
