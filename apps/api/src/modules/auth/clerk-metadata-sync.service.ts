import type { AitekRole, CompanyMembershipRole, UserRole } from '@aitek/types'
import { createClerkClient } from '@clerk/backend'
import { Injectable, Logger } from '@nestjs/common'


interface PublicMetadataInput {
  role?: UserRole
  aitekRole?: AitekRole
  companyId?: string
  companyMembershipRole?: CompanyMembershipRole
}

// Pushes role / companyId / companyMembershipRole into Clerk publicMetadata.
//
// publicMetadata is the source of truth for these three claims (locked in
// planning/25-auth-onboarding-day-plan.md §1). The Clerk JWT template
// "aitek-portal-default" reads from publicMetadata so they appear on every
// session token. Failures here are logged but never propagate — the request
// the user is making should still succeed even if the metadata sync flakes.
@Injectable()
export class ClerkMetadataSyncService {
  private readonly logger = new Logger(ClerkMetadataSyncService.name)
  private readonly clerk = createClerkClient({
    secretKey: process.env['CLERK_SECRET_KEY'] ?? '',
  })

  // Fetch a user's identity straight from Clerk. Used as a fallback when the
  // user.created webhook hasn't delivered yet (common in local dev without
  // ngrok) so /auth/me can self-heal by creating the DB row on first call.
  async getClerkUser(clerkId: string): Promise<{
    email: string
    firstName: string
    lastName: string
    publicMetadata: Record<string, unknown>
  } | null> {
    if (!clerkId || clerkId.startsWith('seed-')) return null
    try {
      const u = await this.clerk.users.getUser(clerkId)
      return {
        email: u.emailAddresses[0]?.emailAddress ?? '',
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        // Invitations stash role/aitekRole here; carried over to the user on
        // acceptance so the DB row can be created with the right role.
        publicMetadata: (u.publicMetadata ?? {}) as Record<string, unknown>,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Clerk getUser failed for ${clerkId}: ${msg}`)
      return null
    }
  }

  // Create a Clerk invitation. Clerk emails the recipient a link to
  // `redirectUrl` with a one-time ticket; on the sign-up page they set a
  // password (email is pre-verified). The publicMetadata (role / aitekRole) is
  // copied onto the user when they accept.
  async createInvitation(params: {
    email: string
    publicMetadata: Record<string, unknown>
    redirectUrl: string
  }): Promise<{ id: string; url: string; status: string }> {
    const inv = await this.clerk.invitations.createInvitation({
      emailAddress: params.email,
      publicMetadata: params.publicMetadata,
      redirectUrl: params.redirectUrl,
      notify: true,
      ignoreExisting: false,
    })
    return { id: inv.id, url: inv.url ?? '', status: inv.status }
  }

  async sync(clerkId: string, metadata: PublicMetadataInput): Promise<void> {
    if (!clerkId || clerkId.startsWith('seed-')) {
      // Seed-only users don't exist in Clerk yet — they'll get synced when they
      // sign up for real. This is expected, not an error.
      return
    }

    const cleaned: Record<string, unknown> = {}
    if (metadata.role !== undefined) cleaned['role'] = metadata.role
    if (metadata.aitekRole !== undefined) cleaned['aitekRole'] = metadata.aitekRole
    if (metadata.companyId !== undefined) cleaned['companyId'] = metadata.companyId
    if (metadata.companyMembershipRole !== undefined) {
      cleaned['companyMembershipRole'] = metadata.companyMembershipRole
    }
    if (Object.keys(cleaned).length === 0) return

    try {
      await this.clerk.users.updateUserMetadata(clerkId, { publicMetadata: cleaned })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Clerk publicMetadata sync failed for ${clerkId}: ${msg}`)
    }
  }
}
