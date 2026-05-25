import { z } from 'zod'

export const createCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters').max(100),
  // Optional text fields: an empty input is valid (no `.min(1)`, which would
  // reject '' and surface a spurious "too small" error on a field the user
  // chose to leave blank).
  businessType: z.string().max(100, 'Keep this under 100 characters').optional(),
  industry: z.string().max(100, 'Keep this under 100 characters').optional(),
  employeeCount: z.string().optional(),
  country: z.string().max(100, 'Keep this under 100 characters').optional(),
  state: z.string().max(100, 'Keep this under 100 characters').optional(),
  website: z.string().url('Enter a valid URL, including https://').optional().or(z.literal('')),
  socialLinks: z
    .object({
      linkedin: z
        .string()
        .url('Enter a valid URL, including https://')
        .optional()
        .or(z.literal('')),
      twitter: z
        .string()
        .url('Enter a valid URL, including https://')
        .optional()
        .or(z.literal('')),
    })
    .optional(),
  existingSoftwareStack: z.array(z.string()).optional(),
  annualRevenueRange: z.string().optional(),
  yearsInBusiness: z.string().optional(),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>

export const updateCompanySchema = createCompanySchema.partial()
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
