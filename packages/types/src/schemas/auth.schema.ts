import { z } from 'zod'

import { CompanyMembershipRole, KYCStatus, OnboardingPhase, UserRole } from '../enums'

export const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.nativeEnum(CompanyMembershipRole).default(CompanyMembershipRole.CLIENT_USER),
})

export type InviteInput = z.infer<typeof inviteSchema>

export const acceptInviteSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
})

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>

// Shape of the AuthUser injected into every request context.
//
// Base fields come from the Clerk JWT (template "aitek-portal-default" reads
// from publicMetadata). Derived fields (kycStatus / hasSelectedServices /
// onboardingComplete / portalAccessGranted) are populated by AuthService.getUserContext
// at /auth/me request time — they are NOT in the JWT and will be undefined when
// hydrated by ClerkAuthGuard alone.
export const authUserSchema = z.object({
  id: z.string(),
  clerkId: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.nativeEnum(UserRole),
  companyId: z.string().optional(),
  companyMembershipRole: z.nativeEnum(CompanyMembershipRole).optional(),
  portalAccessGranted: z.boolean().optional(),
  kycStatus: z.nativeEnum(KYCStatus).optional(),
  hasSelectedServices: z.boolean().optional(),
  onboardingComplete: z.boolean().optional(),
  onboardingPhase: z.nativeEnum(OnboardingPhase).optional(),
})

export type AuthUser = z.infer<typeof authUserSchema>
