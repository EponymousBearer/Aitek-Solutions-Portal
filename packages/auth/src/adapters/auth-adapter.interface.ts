import type { AuthUser } from '@aitek/types'

export interface AuthAdapter {
  /**
   * Validates a JWT token and returns the decoded AuthUser.
   * Throws an error if the token is invalid or expired.
   */
  validateToken(token: string): Promise<AuthUser>

  /**
   * Fetches a user by their external provider ID (e.g., Clerk user ID).
   */
  getUserById(externalId: string): Promise<AuthUser | null>

  /**
   * Sends an invitation email to the given address with optional metadata.
   */
  inviteUser(email: string, metadata: Record<string, unknown>): Promise<void>

  /**
   * Revokes all active sessions for a user (force logout).
   */
  revokeAllSessions(externalId: string): Promise<void>
}
