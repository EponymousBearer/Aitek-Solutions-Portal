import type { AuthUser } from '@aitek/types'

import type { AuthAdapter } from './auth-adapter.interface'

/**
 * Clerk implementation of the AuthAdapter.
 * The actual Clerk SDK dependency lives in apps/api — this is a stub
 * that will be completed when the Clerk SDK is installed there.
 *
 * This file defines the contract. Import and implement in the API module.
 */
export class ClerkAuthAdapter implements AuthAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly clerkClient: any) {}

  async validateToken(_token: string): Promise<AuthUser> {
    throw new Error('ClerkAuthAdapter.validateToken not yet implemented')
  }

  async getUserById(_externalId: string): Promise<AuthUser | null> {
    throw new Error('ClerkAuthAdapter.getUserById not yet implemented')
  }

  async inviteUser(_email: string, _metadata: Record<string, unknown>): Promise<void> {
    throw new Error('ClerkAuthAdapter.inviteUser not yet implemented')
  }

  async revokeAllSessions(_externalId: string): Promise<void> {
    throw new Error('ClerkAuthAdapter.revokeAllSessions not yet implemented')
  }
}
