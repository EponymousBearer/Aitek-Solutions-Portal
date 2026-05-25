'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface to the browser console so we can see what blew up without
    // having to dig through the Next.js server logs.
    // eslint-disable-next-line no-console
    console.error('App error boundary caught:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8">
      <div className="max-w-2xl space-y-3 text-center">
        <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The app hit an unexpected error. The details are below &mdash; copy them if you need to
          share with support.
        </p>
        <pre className="overflow-auto rounded-md border border-border bg-muted p-4 text-left text-xs text-foreground">
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ''}
          {error.digest ? `\n\ndigest: ${error.digest}` : ''}
        </pre>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
