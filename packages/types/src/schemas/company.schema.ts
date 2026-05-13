import { z } from 'zod'

export const createCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  businessType: z.string().min(1).max(100).optional(),
  industry: z.string().min(1).max(100).optional(),
  employeeCount: z.string().optional(),
  country: z.string().min(1).max(100).optional(),
  state: z.string().max(100).optional(),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  socialLinks: z
    .object({
      linkedin: z.string().url().optional().or(z.literal('')),
      twitter: z.string().url().optional().or(z.literal('')),
    })
    .optional(),
  existingSoftwareStack: z.array(z.string()).optional(),
  annualRevenueRange: z.string().optional(),
  yearsInBusiness: z.string().optional(),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>

export const updateCompanySchema = createCompanySchema.partial()
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
