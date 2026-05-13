export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-sm">
            <span className="text-xl font-bold text-white">A</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">AiTek Portal</h1>
            <p className="text-sm text-muted-foreground">Enterprise Solutions Platform</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
