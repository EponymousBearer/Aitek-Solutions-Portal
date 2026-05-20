import { NextResponse } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite(.*)',
  '/api/webhooks(.*)',
])

const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)'])
const isPortalRoute = createRouteMatcher(['/portal(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()

  // Public routes — allow unauthenticated access
  if (isPublicRoute(req)) {
    // Redirect signed-in users away from auth pages
    if (
      userId &&
      (req.nextUrl.pathname.startsWith('/sign-in') ||
        req.nextUrl.pathname.startsWith('/sign-up'))
    ) {
      return NextResponse.redirect(new URL('/portal', req.url))
    }
    return NextResponse.next()
  }

  // All protected routes require authentication
  if (!userId) {
    return NextResponse.redirect(
      new URL(`/sign-in?redirect_url=${encodeURIComponent(req.url)}`, req.url),
    )
  }

  // Role from Clerk session claims (set via Clerk JWT template or publicMetadata sync)
  const role = (sessionClaims?.['role'] as string | undefined) ?? ''

  // Admin routes require AITEK_ADMIN role
  if (isAdminRoute(req) && role !== 'AITEK_ADMIN') {
    return NextResponse.redirect(new URL('/portal', req.url))
  }

  // Portal and onboarding routes — allow any authenticated user
  if (isPortalRoute(req) || isOnboardingRoute(req)) {
    return NextResponse.next()
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
