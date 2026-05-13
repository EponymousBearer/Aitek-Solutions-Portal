export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <span className="text-2xl font-bold text-primary-foreground">A</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">AiTek Portal</h1>
        <p className="max-w-md text-muted-foreground">
          AI-first client onboarding and project management platform.
        </p>
        <div className="mt-4 flex gap-3">
          <a
            href="/sign-in"
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign in
          </a>
          <a
            href="/sign-up"
            className="rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Get started
          </a>
        </div>
      </div>
    </main>
  )
}
