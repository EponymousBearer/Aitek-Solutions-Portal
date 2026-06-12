import { BrandLogo } from '@/components/layout/brand-logo'

export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-md">
        {/* Brand logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <BrandLogo className="h-12 w-auto" />
          <p className="text-sm text-muted-foreground">Enterprise Solutions Platform</p>
        </div>
        {children}
      </div>
    </div>
  )
}
