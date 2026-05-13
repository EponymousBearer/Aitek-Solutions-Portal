'use client'

import { useState } from 'react'

import { QueryClientProvider } from '@tanstack/react-query'

import { createQueryClient } from '@/lib/query-client'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Each browser tab gets its own QueryClient instance
  const [queryClient] = useState(() => createQueryClient())

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
