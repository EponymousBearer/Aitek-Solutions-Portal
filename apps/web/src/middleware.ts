import { NextResponse } from 'next/server'

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
])

// Role-based route matchers — used in Prompt 5 when auth + RBAC is wired
// const isAdminRoute = createRouteMatcher(['/admin(.*)'])
// const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)'])
// const isPortalRoute = createRouteMatcher(['/portal(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  // Allow public routes through
  if (isPublicRoute(req)) {
    // Redirect signed-in users away from auth pages
    if (userId && (req.nextUrl.pathname === '/sign-in' || req.nextUrl.pathname === '/sign-up')) {
      return NextResponse.redirect(new URL('/portal', req.url))
    }
    return NextResponse.next()
  }

  // Require auth for all protected routes
  if (!userId) {
    return NextResponse.redirect(
      new URL(`/sign-in?redirect_url=${encodeURIComponent(req.url)}`, req.url),
    )
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
