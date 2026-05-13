import { z } from 'zod'

import { CompanyMembershipRole, UserRole } from '../enums'

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

// Shape of the AuthUser injected into every request context
export const authUserSchema = z.object({
  id: z.string(),
  clerkId: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.nativeEnum(UserRole),
  companyId: z.string().optional(),
  companyMembershipRole: z.nativeEnum(CompanyMembershipRole).optional(),
})

export type AuthUser = z.infer<typeof authUserSchema>
