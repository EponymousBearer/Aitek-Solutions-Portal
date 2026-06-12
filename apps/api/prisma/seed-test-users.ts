// ─────────────────────────────────────────────────────────────────────────────
// Provision one test account per role on the dev environment.
//
// Creates (or updates, idempotently) a Clerk user + matching DB row for each of
// the four role views a tester needs: AiTek Admin, Project Manager, Developer,
// and Client. Passwords are set directly via the Clerk Backend API so the
// accounts can be handed to a reviewer without going through the email-invite
// flow. The Client account is also given a company, granted portal access, a
// completed onboarding session, and a project so the client portal renders with
// real content instead of bouncing into onboarding.
//
// Run on the VPS (same pattern as the deploy seed step):
//
//   cd /opt/aitek-portal
//   docker compose run --rm api sh -c 'cd /app && \
//     /app/apps/api/node_modules/.bin/ts-node --transpile-only --skipProject \
//     --compiler-options "{\"module\":\"commonjs\",\"target\":\"es2020\",\"esModuleInterop\":true,\"resolveJsonModule\":true}" \
//     /app/prisma/seed-test-users.ts'
//
// Requires CLERK_SECRET_KEY and DATABASE_URL in the environment (the `api`
// service already provides both). Safe to re-run — every step is upsert/ensure.
// ─────────────────────────────────────────────────────────────────────────────

import {
  AitekRole,
  CompanyMembershipRole,
  OnboardingPhase,
  OnboardingStatus,
  PrismaClient,
  ProjectStatus,
  UserRole,
  UserStatus,
} from '@prisma/client'
import { createClerkClient } from '@clerk/backend'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { config } from 'dotenv'
import path from 'path'

config({ path: path.join(__dirname, '../.env.local') })
config({ path: path.join(__dirname, '../.env') })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(new Pool({ connectionString: process.env['DATABASE_URL'] }) as any)
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

const clerk = createClerkClient({ secretKey: process.env['CLERK_SECRET_KEY'] ?? '' })

// ── Account definitions ──────────────────────────────────────────────────────
// Keep these in sync with the credential list printed at the end of the run.

type TestAccount = {
  key: 'admin' | 'pm' | 'dev' | 'client'
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
  aitekRole?: AitekRole
}

const ACCOUNTS: TestAccount[] = [
  {
    key: 'admin',
    email: 'admin+clerk_test@aitek-solutions.com',
    password: 'AitekAdmin@2026',
    firstName: 'Admin',
    lastName: 'Tester',
    role: UserRole.AITEK_ADMIN,
  },
  {
    key: 'pm',
    email: 'pm-test@mailinator.com',
    password: 'AitekPm@2026',
    firstName: 'Pat',
    lastName: 'Manager',
    role: UserRole.AITEK_TEAM_MEMBER,
    aitekRole: AitekRole.PROJECT_MANAGER,
  },
  {
    key: 'dev',
    email: 'dev-test@mailinator.com',
    password: 'AitekDev@2026',
    firstName: 'Dana',
    lastName: 'Developer',
    role: UserRole.AITEK_TEAM_MEMBER,
    aitekRole: AitekRole.DEVELOPER,
  },
  {
    key: 'client',
    email: 'client@mailinator.com',
    password: 'Client@1234',
    firstName: 'Casey',
    lastName: 'Client',
    role: UserRole.CLIENT_USER,
  },
]

// ── Clerk: ensure a password-set, role-tagged user exists ────────────────────

// publicMetadata is the source of truth for JWT claims (role / aitekRole /
// companyId / companyMembershipRole). Mirror what ClerkMetadataSyncService.sync
// would write so the session token carries the right role on first sign-in.
async function ensureClerkUser(acct: TestAccount) {
  const publicMetadata: Record<string, unknown> = { role: acct.role }
  if (acct.aitekRole) publicMetadata['aitekRole'] = acct.aitekRole

  // getUserList shape differs across @clerk/backend versions (array vs {data}).
  const res = await clerk.users.getUserList({ emailAddress: [acct.email] })
  const existing = (Array.isArray(res) ? res : res.data)?.[0]

  if (existing) {
    await clerk.users.updateUser(existing.id, {
      password: acct.password,
      skipPasswordChecks: true,
    })
    await clerk.users.updateUserMetadata(existing.id, { publicMetadata })
    console.log(`  ↻ Clerk user updated: ${acct.email}`)
    return existing.id
  }

  const created = await clerk.users.createUser({
    emailAddress: [acct.email],
    password: acct.password,
    firstName: acct.firstName,
    lastName: acct.lastName,
    publicMetadata,
    skipPasswordChecks: true,
  })
  console.log(`  + Clerk user created: ${acct.email}`)
  return created.id
}

// ── DB: ensure the User row matches the role (don't rely on the webhook) ──────

async function ensureDbUser(acct: TestAccount, clerkId: string) {
  return prisma.user.upsert({
    where: { email: acct.email },
    update: {
      clerkId,
      role: acct.role,
      aitekRole: acct.aitekRole ?? null,
      status: UserStatus.ACTIVE,
      firstName: acct.firstName,
      lastName: acct.lastName,
    },
    create: {
      clerkId,
      email: acct.email,
      firstName: acct.firstName,
      lastName: acct.lastName,
      role: acct.role,
      aitekRole: acct.aitekRole ?? null,
      status: UserStatus.ACTIVE,
    },
  })
}

// ── Client portal fixtures: company + membership + onboarding + project ───────
// Without these the client lands in the onboarding flow. Giving the client a
// granted company with a completed onboarding session and a project makes the
// portal render like a real, approved client.

const CLIENT_COMPANY_SLUG = 'test-client-co'

async function ensureClientPortal(userId: string) {
  const company = await prisma.company.upsert({
    where: { slug: CLIENT_COMPANY_SLUG },
    update: { portalAccessGranted: true, onboardingPhase: OnboardingPhase.SUBMITTED },
    create: {
      name: 'Test Client Co',
      slug: CLIENT_COMPANY_SLUG,
      industry: 'Technology',
      country: 'United States',
      portalAccessGranted: true,
      onboardingPhase: OnboardingPhase.SUBMITTED,
    },
  })

  // Client is the company admin.
  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId, companyId: company.id } },
    update: { isActive: true, role: CompanyMembershipRole.CLIENT_ADMIN },
    create: {
      userId,
      companyId: company.id,
      role: CompanyMembershipRole.CLIENT_ADMIN,
      isActive: true,
    },
  })

  // A COMPLETED onboarding session flips /auth/me's onboardingComplete to true.
  const existingSession = await prisma.onboardingSession.findFirst({
    where: { companyId: company.id, userId, status: OnboardingStatus.COMPLETED },
    select: { id: true },
  })
  if (!existingSession) {
    await prisma.onboardingSession.create({
      data: {
        companyId: company.id,
        userId,
        status: OnboardingStatus.COMPLETED,
        completedAt: new Date(),
      },
    })
  }

  // One project so the portal has something to show.
  const existingProject = await prisma.project.findFirst({
    where: { companyId: company.id },
    select: { id: true },
  })
  if (!existingProject) {
    await prisma.project.create({
      data: {
        companyId: company.id,
        name: 'Test Engagement',
        slug: 'test-engagement',
        description: 'Sample project for reviewer testing.',
        status: ProjectStatus.DISCOVERY,
        createdById: userId,
      },
    })
  }

  return company
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env['CLERK_SECRET_KEY']) {
    throw new Error('CLERK_SECRET_KEY is required to provision test users')
  }

  console.log('Provisioning role-based test accounts...\n')

  for (const acct of ACCOUNTS) {
    console.log(`• ${acct.key.toUpperCase()} — ${acct.email}`)

    const clerkId = await ensureClerkUser(acct)
    const dbUser = await ensureDbUser(acct, clerkId)

    if (acct.key === 'client') {
      const company = await ensureClientPortal(dbUser.id)
      // Re-sync client JWT claims now that the company exists.
      await clerk.users.updateUserMetadata(clerkId, {
        publicMetadata: {
          role: acct.role,
          companyId: company.id,
          companyMembershipRole: CompanyMembershipRole.CLIENT_ADMIN,
        },
      })
      console.log(`  ✓ Client portal ready (company ${company.id}, access granted)`)
    }
  }

  console.log('\n────────────────────────────────────────────────────────')
  console.log(' Role            Email                                  Password')
  console.log('────────────────────────────────────────────────────────')
  for (const a of ACCOUNTS) {
    const role = a.aitekRole ? `${a.key} (${a.aitekRole})` : a.key
    console.log(` ${role.padEnd(15)} ${a.email.padEnd(38)} ${a.password}`)
  }
  console.log('────────────────────────────────────────────────────────')
  console.log('\nTest accounts ready ✓')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
