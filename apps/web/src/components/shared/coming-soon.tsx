import { Construction } from 'lucide-react'

interface ComingSoonProps {
  title: string
  description?: string
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-background p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Construction className="h-5 w-5 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground/60">Coming in Sprint 3+</p>
    </div>
  )
}
