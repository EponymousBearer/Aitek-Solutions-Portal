import type { AuthUser } from '@aitek/types'
import { UserRole, CompanyMembershipRole } from '@aitek/types'

import type { AuthAdapter } from './auth-adapter.interface'

export class ClerkAuthAdapter implements AuthAdapter {
  // clerkClient is @clerk/backend's createClerkClient() result, typed as any to avoid
  // adding @clerk/backend as a peer dep of this package.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly clerkClient: any) {}

  async validateToken(_token: string): Promise<AuthUser> {
    // Token verification is handled by ClerkAuthGuard via verifyToken from @clerk/backend.
    throw new Error('Use ClerkAuthGuard for token validation — it calls verifyToken directly.')
  }

  async getUserById(clerkId: string): Promise<AuthUser | null> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const clerkUser = await this.clerkClient.users.getUser(clerkId)
    if (!clerkUser) return null

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const emailAddresses = clerkUser.emailAddresses as Array<{ emailAddress: string }>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const meta = clerkUser.publicMetadata as Record<string, unknown>

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      id: clerkUser.id as string,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      clerkId: clerkUser.id as string,
      email: emailAddresses[0]?.emailAddress ?? '',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      firstName: (clerkUser.firstName as string) ?? '',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      lastName: (clerkUser.lastName as string) ?? '',
      role: (meta['role'] as UserRole) ?? UserRole.CLIENT_USER,
      companyId: (meta['companyId'] as string) ?? undefined,
      companyMembershipRole: (meta['companyMembershipRole'] as CompanyMembershipRole) ?? undefined,
    }
  }

  async inviteUser(email: string, metadata: Record<string, unknown>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await this.clerkClient.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: metadata,
    })
  }

  async revokeAllSessions(clerkId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const result = await this.clerkClient.sessions.getSessionList({ userId: clerkId })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const sessions = result.data as Array<{ id: string }>
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      sessions.map((s) => this.clerkClient.sessions.revokeSession(s.id)),
    )
  }
}
