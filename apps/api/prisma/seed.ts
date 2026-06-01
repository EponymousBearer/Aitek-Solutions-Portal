import { PrismaClient, UserRole, UserStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { config } from 'dotenv'
import path from 'path'

config({ path: path.join(__dirname, '../.env.local') })
config({ path: path.join(__dirname, '../.env') })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(new Pool({ connectionString: process.env['DATABASE_URL'] }) as any)
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

// ─────────────────────────────────────────────────────────────────────────────
// Service catalog + service-scoped questionnaires.
//
// The catalog mirrors the PRD's 10 service groups. Each service carries its own
// suggested-question set (PRD §5), which becomes a service-scoped
// QuestionnaireTemplate. At onboarding time the questionnaire is assembled
// dynamically from the question sets of whatever services the client selected,
// plus a shared "Project basics" template (budget / timeline / anything-else).
// ─────────────────────────────────────────────────────────────────────────────

type SeedQuestion = {
  text: string
  type:
    | 'TEXT'
    | 'LONG_TEXT'
    | 'MULTIPLE_CHOICE'
    | 'CHECKBOX'
    | 'BUDGET_SLIDER'
    | 'TIMELINE_SELECTOR'
    | 'TEAM_SIZE'
    | 'URL_INPUT'
  isRequired?: boolean
  helpText?: string
  options?: string[]
  timelineOptions?: string[]
  budgetMin?: number
  budgetMax?: number
  budgetStep?: number
  budgetCurrency?: string
}

type SeedService = {
  name: string
  slug: string
  icon: string
  description: string
  questions: SeedQuestion[]
}

type SeedCategory = {
  name: string
  slug: string
  description: string
  services: SeedService[]
}

// Shared questions every onboarding ends with, regardless of services selected.
const SHARED_QUESTIONS: SeedQuestion[] = [
  {
    text: 'What is your estimated budget range for this engagement?',
    type: 'BUDGET_SLIDER',
    isRequired: true,
    budgetMin: 5000,
    budgetMax: 500000,
    budgetStep: 5000,
    budgetCurrency: 'USD',
  },
  {
    text: 'What is your target timeline to get started?',
    type: 'TIMELINE_SELECTOR',
    isRequired: true,
    timelineOptions: ['ASAP', '< 1 month', '1-3 months', '3-6 months', '6-12 months', 'Just exploring'],
  },
  {
    text: 'Anything else we should know before we put together a proposal?',
    type: 'LONG_TEXT',
    isRequired: false,
    helpText: 'Optional — constraints, must-haves, context, anything at all.',
  },
]

const CATALOG: SeedCategory[] = [
  {
    name: 'Brand & Growth',
    slug: 'brand-growth',
    description: 'Brand identity, positioning, and customer acquisition',
    services: [
      {
        name: 'Branding & Business Growth',
        slug: 'branding-business-growth',
        icon: 'sparkles',
        description: 'Brand identity development, premium positioning, patient/customer acquisition strategy',
        questions: [
          { text: 'Do you already have branding in place?', type: 'MULTIPLE_CHOICE', options: ['Yes, established', 'Partially', 'No, starting fresh'] },
          { text: 'Who is your target audience?', type: 'LONG_TEXT' },
          { text: 'What marketing channels are you using today?', type: 'LONG_TEXT' },
          { text: 'Do you have existing brand guidelines?', type: 'MULTIPLE_CHOICE', options: ['Yes', 'No'] },
          { text: 'Who are your main competitors?', type: 'LONG_TEXT', isRequired: false },
        ],
      },
    ],
  },
  {
    name: 'Facilities & Experience',
    slug: 'facilities-experience',
    description: 'Physical buildouts and patient/customer experience systems',
    services: [
      {
        name: 'Practice / Business Setup & Physical Infrastructure',
        slug: 'practice-setup-infrastructure',
        icon: 'building-2',
        description: 'Practice buildouts and facility experience design',
        questions: [
          { text: 'Is this a new setup or a renovation?', type: 'MULTIPLE_CHOICE', options: ['New setup', 'Renovation'] },
          { text: 'What is the approximate facility size?', type: 'TEXT', helpText: 'e.g. 2,500 sq ft, 8 treatment rooms' },
          { text: 'What aesthetic or experience are you going for?', type: 'LONG_TEXT' },
        ],
      },
      {
        name: 'Patient / Customer Experience Systems',
        slug: 'patient-customer-experience',
        icon: 'heart-handshake',
        description: 'Appointments, communication, CRM, and engagement systems',
        questions: [
          { text: 'What appointment system do you use today?', type: 'TEXT', isRequired: false },
          { text: 'How do you communicate with patients/customers today?', type: 'LONG_TEXT' },
          { text: 'What is your current no-show / drop-off rate?', type: 'TEXT', isRequired: false },
          { text: 'What CRM systems are you using?', type: 'TEXT', isRequired: false },
        ],
      },
    ],
  },
  {
    name: 'Technology & Engineering',
    slug: 'technology-engineering',
    description: 'Software, cloud, and data engineering',
    services: [
      {
        name: 'IT Systems & Application Development',
        slug: 'it-systems-app-development',
        icon: 'code-2',
        description: 'Custom applications, practice management systems, integrations, CMS development',
        questions: [
          { text: 'What existing software are you running?', type: 'LONG_TEXT' },
          { text: 'What integrations do you need?', type: 'LONG_TEXT', isRequired: false },
          { text: 'Which platforms do you need?', type: 'CHECKBOX', options: ['Web', 'iOS', 'Android', 'Desktop', 'API only'] },
          { text: 'How many users will use the system?', type: 'TEAM_SIZE' },
          { text: 'Any compliance requirements?', type: 'LONG_TEXT', isRequired: false },
          { text: 'Is a mobile app needed?', type: 'MULTIPLE_CHOICE', options: ['Yes', 'No', 'Maybe'] },
        ],
      },
      {
        name: 'Cloud & Infrastructure Solutions',
        slug: 'cloud-infrastructure',
        icon: 'cloud',
        description: 'Cloud migration, infrastructure, scaling, and reliability',
        questions: [
          { text: 'What is your current cloud provider (if any)?', type: 'TEXT', isRequired: false },
          { text: 'Are you on-premise, cloud, or hybrid today?', type: 'MULTIPLE_CHOICE', options: ['On-premise', 'Cloud', 'Hybrid', 'Not sure'] },
          { text: 'What are your current infrastructure pain points?', type: 'LONG_TEXT' },
          { text: 'What are your scaling requirements?', type: 'LONG_TEXT', isRequired: false },
          { text: 'Any specific security concerns?', type: 'LONG_TEXT', isRequired: false },
        ],
      },
      {
        name: 'Data, AI & Analytics',
        slug: 'data-ai-analytics',
        icon: 'brain-circuit',
        description: 'Data platforms, AI use cases, reporting, and automation',
        questions: [
          { text: 'What data systems do you have today?', type: 'LONG_TEXT' },
          { text: 'What AI use cases are you interested in?', type: 'LONG_TEXT' },
          { text: 'What are your reporting needs?', type: 'LONG_TEXT', isRequired: false },
          { text: 'Roughly how much data are you working with?', type: 'TEXT', isRequired: false, helpText: 'e.g. GB/TB, rows, records' },
          { text: 'What automation goals do you have?', type: 'LONG_TEXT', isRequired: false },
        ],
      },
    ],
  },
  {
    name: 'Security & Compliance',
    slug: 'security-compliance',
    description: 'Cybersecurity, compliance, and governance',
    services: [
      {
        name: 'Cybersecurity & Compliance',
        slug: 'cybersecurity-compliance',
        icon: 'shield-check',
        description: 'Security assessments, compliance programs, governance, and audits',
        questions: [
          { text: 'Which compliance frameworks apply to you?', type: 'CHECKBOX', options: ['HIPAA', 'SOC 2', 'GDPR', 'PCI-DSS', 'ISO 27001', 'Other', 'Not sure'] },
          { text: 'What security tools do you have in place?', type: 'LONG_TEXT', isRequired: false },
          { text: 'Have you had any previous breaches or incidents?', type: 'MULTIPLE_CHOICE', options: ['Yes', 'No', 'Not sure'] },
          { text: 'Do you have data governance policies today?', type: 'LONG_TEXT', isRequired: false },
          { text: 'What are your audit requirements?', type: 'LONG_TEXT', isRequired: false },
        ],
      },
    ],
  },
  {
    name: 'Operations & Advisory',
    slug: 'operations-advisory',
    description: 'Digital workplace, strategy, and industry-specific solutions',
    services: [
      {
        name: 'Digital Workplace & Operations',
        slug: 'digital-workplace-operations',
        icon: 'workflow',
        description: 'Collaboration tooling, ERP, and operational workflow improvements',
        questions: [
          { text: 'What collaboration tools do you currently use?', type: 'LONG_TEXT' },
          { text: 'What ERP systems are in place?', type: 'TEXT', isRequired: false },
          { text: 'Where are your biggest workflow bottlenecks?', type: 'LONG_TEXT' },
          { text: 'Which departments are involved?', type: 'LONG_TEXT', isRequired: false },
        ],
      },
      {
        name: 'Consulting & Strategy',
        slug: 'consulting-strategy',
        icon: 'compass',
        description: 'Growth strategy, operational advisory, and expansion planning',
        questions: [
          { text: 'What are your primary growth goals?', type: 'LONG_TEXT' },
          { text: 'What operational issues are you facing today?', type: 'LONG_TEXT' },
          { text: 'Do you have expansion plans?', type: 'LONG_TEXT', isRequired: false },
          { text: 'What business KPIs matter most to you?', type: 'LONG_TEXT', isRequired: false },
        ],
      },
      {
        name: 'Industry-Specific Solutions',
        slug: 'industry-specific',
        icon: 'factory',
        description: 'Manufacturing, supply chain, IoT, and vertical-specific automation',
        questions: [
          { text: 'Describe your core manufacturing / operational processes.', type: 'LONG_TEXT' },
          { text: 'What supply chain software do you use?', type: 'TEXT', isRequired: false },
          { text: 'Do you use IoT / connected devices?', type: 'MULTIPLE_CHOICE', options: ['Yes', 'No', 'Exploring'] },
          { text: 'What factory / process automation needs do you have?', type: 'LONG_TEXT', isRequired: false },
        ],
      },
    ],
  },
]

const SHARED_TEMPLATE_SLUG = 'project-basics-v1'

function collectSlugs() {
  const categorySlugs = CATALOG.map((c) => c.slug)
  const serviceSlugs = CATALOG.flatMap((c) => c.services.map((s) => s.slug))
  return { categorySlugs, serviceSlugs }
}

// Upsert a template's questions using a deterministic id so re-running the seed
// is idempotent (no duplicate rows).
async function upsertQuestions(templateId: string, questions: SeedQuestion[]) {
  for (const [i, q] of questions.entries()) {
    const id = `seed-${templateId}-${i}`
    const data = {
      templateId,
      text: q.text,
      type: q.type,
      section: null,
      isRequired: q.isRequired ?? true,
      sortOrder: i,
      helpText: q.helpText ?? null,
      options: q.options ?? undefined,
      timelineOptions: q.timelineOptions ?? undefined,
      budgetMin: q.budgetMin ?? null,
      budgetMax: q.budgetMax ?? null,
      budgetStep: q.budgetStep ?? null,
      budgetCurrency: q.budgetCurrency ?? null,
    }
    await prisma.question.upsert({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { id: id as any },
      update: data,
      create: { id, ...data },
    })
  }
  // Drop any stale questions from a previous, longer version of this template.
  await prisma.question.deleteMany({
    where: { templateId, sortOrder: { gte: questions.length } },
  })
}

async function seedServiceCatalog() {
  console.log('Seeding service catalog (PRD 10 service groups)...')
  const { categorySlugs, serviceSlugs } = collectSlugs()

  // Retire any catalog entries from an earlier seed that aren't in the new set,
  // so the storefront only shows the current 10 groups.
  await prisma.service.updateMany({
    where: { slug: { notIn: serviceSlugs } },
    data: { isActive: false },
  })
  await prisma.serviceCategory.updateMany({
    where: { slug: { notIn: categorySlugs } },
    data: { isActive: false },
  })

  for (const [i, cat] of CATALOG.entries()) {
    const category = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, sortOrder: i, isActive: true },
      create: { name: cat.name, slug: cat.slug, description: cat.description, sortOrder: i },
    })

    for (const [j, svc] of cat.services.entries()) {
      const service = await prisma.service.upsert({
        where: { slug: svc.slug },
        update: {
          categoryId: category.id,
          name: svc.name,
          description: svc.description,
          icon: svc.icon,
          sortOrder: j,
          isActive: true,
        },
        create: {
          categoryId: category.id,
          name: svc.name,
          slug: svc.slug,
          description: svc.description,
          icon: svc.icon,
          sortOrder: j,
        },
      })

      // Service-scoped questionnaire template carrying this group's questions.
      const templateSlug = `${svc.slug}-v1`
      const template = await prisma.questionnaireTemplate.upsert({
        where: { slug: templateSlug },
        update: { name: `${svc.name} — Requirements`, serviceId: service.id, isActive: true, isDefault: false },
        create: {
          name: `${svc.name} — Requirements`,
          slug: templateSlug,
          description: `Discovery questions for ${svc.name}`,
          serviceId: service.id,
          isDefault: false,
          isActive: true,
          version: 1,
          createdById: 'seed',
        },
      })
      await upsertQuestions(template.id, svc.questions)
    }
  }

  console.log('✓ Service catalog + per-service questionnaires seeded')
}

async function seedSharedQuestionnaire() {
  console.log('Seeding shared "Project basics" questionnaire...')

  // Retire the previous default template so only one isDefault template exists.
  await prisma.questionnaireTemplate.updateMany({
    where: { isDefault: true, slug: { not: SHARED_TEMPLATE_SLUG } },
    data: { isDefault: false, isActive: false },
  })

  const template = await prisma.questionnaireTemplate.upsert({
    where: { slug: SHARED_TEMPLATE_SLUG },
    update: { name: 'Project basics', isDefault: true, isActive: true, serviceId: null },
    create: {
      name: 'Project basics',
      slug: SHARED_TEMPLATE_SLUG,
      description: 'Budget, timeline, and final notes asked of every client',
      serviceId: null,
      isDefault: true,
      isActive: true,
      version: 1,
      createdById: 'seed',
    },
  })
  await upsertQuestions(template.id, SHARED_QUESTIONS)

  console.log('✓ Shared questionnaire seeded')
}

async function seedAdminUser() {
  const email = process.env['ADMIN_EMAIL']
  if (!email) {
    console.warn('⚠ ADMIN_EMAIL not set — skipping admin user seed')
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    if (existing.role !== UserRole.AITEK_ADMIN) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: UserRole.AITEK_ADMIN, status: UserStatus.ACTIVE },
      })
      console.log(`✓ Promoted existing user to AITEK_ADMIN: ${email}`)
      console.log(`  Clerk publicMetadata not synced here — user must sign out/in,`)
      console.log(`  or an admin must trigger a resync, before JWT carries new role.`)
    } else {
      console.log(`✓ Admin user already provisioned: ${email}`)
    }
    return
  }

  // Pre-seed shim. When the real Clerk user signs up with this email, the
  // user.created webhook in AuthService binds the real clerkId to this row and
  // syncs role=AITEK_ADMIN into Clerk publicMetadata.
  await prisma.user.create({
    data: {
      clerkId: `seed-admin-${email}`,
      email,
      firstName: 'Admin',
      lastName: 'AiTek',
      role: UserRole.AITEK_ADMIN,
      status: UserStatus.ACTIVE,
    },
  })
  console.log(`✓ Admin user seeded (clerkId binds on first sign-up): ${email}`)
}

async function main() {
  console.log('Starting seed...')
  await seedServiceCatalog()
  await seedSharedQuestionnaire()
  await seedAdminUser()
  console.log('Seed complete ✓')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
