import type { CompanyMembershipRole, UserRole } from '@aitek/types'
import { createClerkClient } from '@clerk/backend'
import { Injectable, Logger } from '@nestjs/common'


interface PublicMetadataInput {
  role?: UserRole
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

  async sync(clerkId: string, metadata: PublicMetadataInput): Promise<void> {
    if (!clerkId || clerkId.startsWith('seed-')) {
      // Seed-only users don't exist in Clerk yet — they'll get synced when they
      // sign up for real. This is expected, not an error.
      return
    }

    const cleaned: Record<string, unknown> = {}
    if (metadata.role !== undefined) cleaned['role'] = metadata.role
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
