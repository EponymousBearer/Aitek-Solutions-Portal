'use client'

import { ClerkProvider } from '@clerk/nextjs'

const publishableKey = process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // If Clerk key is not configured (local dev without keys), render children directly.
  // In all deployed environments (dev/uat/prod) the key is always set via Azure Key Vault.
  if (!publishableKey) {
    return <>{children}</>
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        variables: {
          colorPrimary: '#3B82F6',
          colorBackground: '#ffffff',
          colorText: '#0f172a',
          borderRadius: '0.5rem',
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
}
