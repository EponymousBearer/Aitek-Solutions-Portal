import type { Metadata } from 'next'

import { Inter } from 'next/font/google'

import { AuthProvider } from '@/providers/clerk-provider'
import { QueryProvider } from '@/providers/query-provider'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'AiTek Portal',
    template: '%s | AiTek Portal',
  },
  description: 'AI-first client onboarding and project portal for AiTek Solutions',
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
