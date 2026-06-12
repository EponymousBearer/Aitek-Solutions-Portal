import { cn } from '@/lib/utils'

/**
 * AiTek Solutions logo (full-colour wordmark + orbit mark).
 *
 * The artwork is dark navy / grey / orange on a transparent background, so it
 * reads well on light surfaces but disappears on the black dark-mode shell.
 * Callers that place it on a theme-aware surface should give it a white backing
 * in dark mode (e.g. `dark:bg-white`) rather than inverting it, which would ruin
 * the colours.
 */
export function BrandLogo({
  className,
  src = '/logo.webp',
}: {
  className?: string
  /** Use `/logo-mark.webp` (tagline-free crop) in tight spots like the sidebar. */
  src?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="AiTek Solutions" className={cn('select-none', className)} />
  )
}
