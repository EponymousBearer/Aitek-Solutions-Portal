import type { Metadata } from 'next'

import { SignUp } from '@clerk/nextjs'

export const metadata: Metadata = { title: 'Create Account' }

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start your AiTek Portal onboarding journey
        </p>
      </div>
      <SignUp
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'shadow-none border border-border rounded-xl p-6',
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
            socialButtonsBlockButton:
              'border border-border bg-background text-foreground hover:bg-muted',
            formButtonPrimary: 'bg-primary hover:bg-primary/90 text-primary-foreground',
          },
        }}
        fallbackRedirectUrl="/onboarding/company"
        signInUrl="/sign-in"
      />
    </div>
  )
}
