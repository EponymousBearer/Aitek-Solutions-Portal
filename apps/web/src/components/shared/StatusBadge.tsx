import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending'

const VARIANT_STYLES: Record<StatusVariant, string> = {
  success:
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25',
  warning:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25',
  error:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/25',
  info: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/25',
  neutral: 'bg-muted text-muted-foreground border-border',
  pending:
    'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/25',
}

interface StatusBadgeProps {
  variant: StatusVariant
  label: string
  className?: string
}

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold',
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {label}
    </span>
  )
}

// Convenience helper — maps KYC status string to variant
export function kycStatusVariant(status: string): StatusVariant {
  switch (status) {
    case 'APPROVED': return 'success'
    case 'REJECTED': return 'error'
    case 'UNDER_REVIEW':
    case 'PENDING': return 'pending'
    case 'RESUBMISSION_REQUIRED': return 'warning'
    default: return 'neutral'
  }
}

export function projectStatusVariant(status: string): StatusVariant {
  switch (status) {
    case 'COMPLETED': return 'success'
    case 'CANCELLED': return 'error'
    case 'ON_HOLD': return 'warning'
    case 'DEVELOPMENT':
    case 'QA':
    case 'DEPLOYMENT': return 'info'
    default: return 'neutral'
  }
}

export { Badge }
