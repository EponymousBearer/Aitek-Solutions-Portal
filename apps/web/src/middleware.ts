import { NextResponse } from 'next/server'

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite(.*)',
  '/api/webhooks(.*)',
])

// Internal AiTek shells. The specific role split (admin vs PM vs developer) is
// enforced client-side by RequireInternalRole — middleware only keeps clients
// out of all three.
const isInternalRoute = createRouteMatcher(['/admin(.*)', '/pm(.*)', '/dev(.*)'])
const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)'])
const isPortalRoute = createRouteMatcher(['/portal(.*)'])

// Best-effort home from JWT claims. aitekRole may be absent if the JWT template
// doesn't expose it yet — team members then default to /pm and PmGuard/DevGuard
// (DB-backed) correct a developer to /dev. Admins and clients are unambiguous.
function homeFromClaims(role?: string, aitekRole?: string): string {
  if (role === 'AITEK_ADMIN') return '/admin'
  if (role === 'AITEK_TEAM_MEMBER') return aitekRole === 'DEVELOPER' ? '/dev' : '/pm'
  return '/portal'
}

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()

  const role = sessionClaims?.['role'] as string | undefined
  const aitekRole = sessionClaims?.['aitekRole'] as string | undefined
  const isAitekRole = role === 'AITEK_ADMIN' || role === 'AITEK_TEAM_MEMBER'

  // Public routes — allow unauthenticated access
  if (isPublicRoute(req)) {
    // Redirect signed-in users away from the sign-in page to their home area.
    if (userId && req.nextUrl.pathname.startsWith('/sign-in')) {
      return NextResponse.redirect(new URL(homeFromClaims(role, aitekRole), req.url))
    }
    // After sign-up (incl. email verification / invitation accept): AiTek team →
    // their area; new clients → onboarding.
    if (userId && req.nextUrl.pathname.startsWith('/sign-up')) {
      return NextResponse.redirect(
        new URL(isAitekRole ? homeFromClaims(role, aitekRole) : '/onboarding/company', req.url),
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

  // AiTek team belongs in their internal shell — keep them out of the client
  // portal and onboarding. (Fast path; only fires when the role claim is
  // present. When absent, PortalGuard / OnboardingGuard handle it DB-backed.)
  if (isAitekRole && (isPortalRoute(req) || isOnboardingRoute(req))) {
    return NextResponse.redirect(new URL(homeFromClaims(role, aitekRole), req.url))
  }

  // Block non-AiTek users from any internal shell. Only act when the claim *is*
  // present and isn't an AiTek role; otherwise the client guards do the DB check.
  if (isInternalRoute(req) && role !== undefined && !isAitekRole) {
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
