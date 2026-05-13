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

const SERVICE_CATEGORIES = [
  {
    name: 'IT Systems & Application Development',
    slug: 'it-systems-app-development',
    description: 'Custom software, web and mobile applications, enterprise systems',
    services: [
      { name: 'Custom Web Application', slug: 'custom-web-app', icon: 'globe' },
      { name: 'Mobile App Development', slug: 'mobile-app-dev', icon: 'smartphone' },
      { name: 'Enterprise Software Integration', slug: 'enterprise-integration', icon: 'layers' },
      { name: 'API Development & Integration', slug: 'api-development', icon: 'code-2' },
    ],
  },
  {
    name: 'AI & Machine Learning',
    slug: 'ai-machine-learning',
    description: 'AI-powered solutions, automation, and intelligent systems',
    services: [
      { name: 'AI Chatbot & Virtual Assistant', slug: 'ai-chatbot', icon: 'bot' },
      { name: 'Predictive Analytics', slug: 'predictive-analytics', icon: 'trending-up' },
      { name: 'Document Intelligence', slug: 'document-intelligence', icon: 'file-search' },
      { name: 'Process Automation (RPA)', slug: 'rpa', icon: 'cog' },
    ],
  },
  {
    name: 'Cloud & Infrastructure',
    slug: 'cloud-infrastructure',
    description: 'Cloud migration, DevOps, and infrastructure management',
    services: [
      { name: 'Cloud Migration', slug: 'cloud-migration', icon: 'cloud-upload' },
      { name: 'DevOps & CI/CD', slug: 'devops-cicd', icon: 'git-merge' },
      { name: 'Infrastructure as Code', slug: 'infrastructure-as-code', icon: 'server' },
    ],
  },
  {
    name: 'Cybersecurity',
    slug: 'cybersecurity',
    description: 'Security assessments, compliance, and threat protection',
    services: [
      { name: 'Security Assessment & Audit', slug: 'security-audit', icon: 'shield-check' },
      { name: 'Compliance Consulting (HIPAA/SOC2)', slug: 'compliance', icon: 'file-badge' },
      { name: 'Penetration Testing', slug: 'pen-testing', icon: 'bug' },
    ],
  },
  {
    name: 'Data & Analytics',
    slug: 'data-analytics',
    description: 'Data engineering, BI dashboards, and analytics platforms',
    services: [
      { name: 'Business Intelligence & Dashboards', slug: 'bi-dashboards', icon: 'bar-chart-2' },
      { name: 'Data Warehouse & ETL', slug: 'data-warehouse', icon: 'database' },
      { name: 'Real-time Analytics', slug: 'realtime-analytics', icon: 'activity' },
    ],
  },
  {
    name: 'Healthcare IT',
    slug: 'healthcare-it',
    description: 'HIPAA-compliant systems, EHR integrations, telehealth platforms',
    services: [
      { name: 'EHR Integration & Interoperability', slug: 'ehr-integration', icon: 'heart-pulse' },
      { name: 'Telehealth Platform', slug: 'telehealth', icon: 'video' },
      { name: 'Patient Portal Development', slug: 'patient-portal', icon: 'user-check' },
    ],
  },
  {
    name: 'E-Commerce & Digital Commerce',
    slug: 'ecommerce',
    description: 'Online stores, payment systems, and commerce platforms',
    services: [
      { name: 'E-Commerce Platform', slug: 'ecommerce-platform', icon: 'shopping-cart' },
      { name: 'Payment Integration', slug: 'payment-integration', icon: 'credit-card' },
      { name: 'Inventory & Order Management', slug: 'inventory-management', icon: 'package' },
    ],
  },
  {
    name: 'UI/UX Design',
    slug: 'ui-ux-design',
    description: 'User research, product design, and design systems',
    services: [
      { name: 'Product Design & Prototyping', slug: 'product-design', icon: 'pen-tool' },
      { name: 'Design System Creation', slug: 'design-system', icon: 'layout-template' },
      { name: 'UX Research & Audit', slug: 'ux-research', icon: 'search' },
    ],
  },
  {
    name: 'Staff Augmentation',
    slug: 'staff-augmentation',
    description: 'Dedicated developers, team extension, and technical consulting',
    services: [
      { name: 'Dedicated Development Team', slug: 'dedicated-team', icon: 'users' },
      { name: 'Technical Consulting', slug: 'technical-consulting', icon: 'lightbulb' },
    ],
  },
  {
    name: 'Managed Services',
    slug: 'managed-services',
    description: 'Ongoing support, maintenance, and monitoring',
    services: [
      { name: 'Application Support & Maintenance', slug: 'app-maintenance', icon: 'wrench' },
      { name: 'Managed Cloud Operations', slug: 'managed-cloud', icon: 'cloud-cog' },
      { name: '24/7 Monitoring & Incident Response', slug: 'monitoring', icon: 'bell' },
    ],
  },
]

async function seedServiceCatalog() {
  console.log('Seeding service categories and services...')
  for (const [i, cat] of SERVICE_CATEGORIES.entries()) {
    const category = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        sortOrder: i,
      },
    })

    for (const [j, svc] of cat.services.entries()) {
      await prisma.service.upsert({
        where: { slug: svc.slug },
        update: {},
        create: {
          categoryId: category.id,
          name: svc.name,
          slug: svc.slug,
          icon: svc.icon,
          sortOrder: j,
        },
      })
    }
  }
  console.log('✓ Service catalog seeded')
}

async function seedDefaultQuestionnaire() {
  console.log('Seeding default questionnaire template...')

  const itService = await prisma.service.findUnique({
    where: { slug: 'custom-web-app' },
  })

  const template = await prisma.questionnaireTemplate.upsert({
    where: { slug: 'it-systems-general-v1' },
    update: {},
    create: {
      name: 'IT Systems & Application Development — General',
      slug: 'it-systems-general-v1',
      description: 'Standard discovery questionnaire for IT and application projects',
      serviceId: itService?.id ?? null,
      isDefault: true,
      isActive: true,
      version: 1,
      createdById: 'seed',
    },
  })

  const questions = [
    {
      text: 'What problem are you trying to solve with this project?',
      type: 'LONG_TEXT' as const,
      section: 'Project Goals',
      sortOrder: 0,
      isRequired: true,
      aiContextHint: 'Core problem statement — use to frame executive summary',
    },
    {
      text: 'Who are the primary users of this system?',
      type: 'LONG_TEXT' as const,
      section: 'Project Goals',
      sortOrder: 1,
      isRequired: true,
    },
    {
      text: 'Do you have an existing system this needs to replace or integrate with?',
      type: 'MULTIPLE_CHOICE' as const,
      section: 'Technical Context',
      sortOrder: 2,
      isRequired: true,
      options: ['Yes, replace existing', 'Yes, integrate with existing', 'No, greenfield'],
    },
    {
      text: 'Describe the existing system and integration requirements',
      type: 'LONG_TEXT' as const,
      section: 'Technical Context',
      sortOrder: 3,
      isRequired: false,
      conditionalLogic: {
        logic: 'ANY',
        rules: [
          { questionIndex: 2, operator: 'equals', value: 'Yes, replace existing' },
          { questionIndex: 2, operator: 'equals', value: 'Yes, integrate with existing' },
        ],
      },
    },
    {
      text: 'What is your estimated budget range for this project?',
      type: 'BUDGET_SLIDER' as const,
      section: 'Budget & Timeline',
      sortOrder: 4,
      isRequired: true,
      budgetMin: 10000,
      budgetMax: 500000,
      budgetStep: 5000,
      budgetCurrency: 'USD',
    },
    {
      text: 'What is your target timeline for initial delivery?',
      type: 'TIMELINE_SELECTOR' as const,
      section: 'Budget & Timeline',
      sortOrder: 5,
      isRequired: true,
      timelineOptions: ['< 1 month', '1-3 months', '3-6 months', '6-12 months', '12+ months'],
    },
    {
      text: 'How many users will use this system?',
      type: 'TEAM_SIZE' as const,
      section: 'Scale & Requirements',
      sortOrder: 6,
      isRequired: true,
    },
    {
      text: 'Which of the following features are required? (select all that apply)',
      type: 'CHECKBOX' as const,
      section: 'Scale & Requirements',
      sortOrder: 7,
      isRequired: true,
      options: [
        'User authentication & roles',
        'File upload & storage',
        'Real-time notifications',
        'API / third-party integrations',
        'Reporting & analytics dashboard',
        'Mobile app (iOS/Android)',
        'Offline functionality',
        'Multi-language support',
      ],
    },
  ]

  for (const q of questions) {
    const { conditionalLogic, options, timelineOptions, ...rest } = q as typeof q & {
      conditionalLogic?: object
      options?: string[]
      timelineOptions?: string[]
    }
    await prisma.question.upsert({
      where: {
        // Use templateId + sortOrder as a stable identifier during seeding
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        id: `seed-${template.id}-${rest.sortOrder}` as any,
      },
      update: {},
      create: {
        id: `seed-${template.id}-${rest.sortOrder}`,
        templateId: template.id,
        ...rest,
        conditionalLogic: conditionalLogic ?? undefined,
        options: options ?? undefined,
        timelineOptions: timelineOptions ?? undefined,
      },
    })
  }

  console.log('✓ Default questionnaire template seeded')
}

async function seedAdminUser() {
  const email = process.env['ADMIN_EMAIL']
  if (!email) {
    console.warn('⚠ ADMIN_EMAIL not set — skipping admin user seed')
    return
  }

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      clerkId: `seed-admin-${email}`,
      email,
      firstName: 'Admin',
      lastName: 'AiTek',
      role: UserRole.AITEK_ADMIN,
      status: UserStatus.ACTIVE,
    },
  })

  console.log(`✓ Admin user seeded: ${email}`)
}

async function main() {
  console.log('Starting seed...')
  await seedServiceCatalog()
  await seedDefaultQuestionnaire()
  await seedAdminUser()
  console.log('Seed complete ✓')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
