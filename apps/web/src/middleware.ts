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

  // Role from Clerk session claims (set via Clerk JWT template or publicMetadata
  // sync). If the JWT template isn't configured the claim is undefined here — in
  // that case we let the request through and let the client-side, DB-backed
  // guards (PortalGuard / OnboardingGuard / AdminGuard) do the real routing.
  const role = sessionClaims?.['role'] as string | undefined
  const isAitekRole = role === 'AITEK_ADMIN' || role === 'AITEK_TEAM_MEMBER'

  // Public routes — allow unauthenticated access
  if (isPublicRoute(req)) {
    // Redirect signed-in users away from auth pages. Aitek team → admin panel;
    // everyone else → portal, which routes them onward to the right step.
    if (userId && req.nextUrl.pathname.startsWith('/sign-in')) {
      return NextResponse.redirect(new URL(isAitekRole ? '/admin' : '/portal', req.url))
    }
    // After sign-up (including email verification): Aitek team → admin panel;
    // new clients → onboarding.
    if (userId && req.nextUrl.pathname.startsWith('/sign-up')) {
      return NextResponse.redirect(
        new URL(isAitekRole ? '/admin' : '/onboarding/company', req.url),
      )
    }
    return NextResponse.next()
  }

  // All protected routes require authentication
  if (!userId) {
    return NextResponse.redirect(
      new URL(`/sign-in?redirect_url=${encodeURIComponent(req.url)}`, req.url),
    )
  }

  // Aitek team belongs in /admin — keep them out of the client portal and
  // onboarding flow. (Fast path; only fires when the role claim is present.
  // When it's absent, PortalGuard / OnboardingGuard handle this DB-backed.)
  if (isAitekRole && (isPortalRoute(req) || isOnboardingRoute(req))) {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  // Block non-Aitek users from the admin panel. Only act when the claim *is*
  // present and isn't an Aitek role; otherwise AdminGuard does the DB check.
  if (isAdminRoute(req) && role !== undefined && !isAitekRole) {
    return NextResponse.redirect(new URL('/portal', req.url))
  }

  // Portal and onboarding routes — allow any authenticated client through
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
