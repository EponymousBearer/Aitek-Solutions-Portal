// File size limits (bytes)
export const MAX_FILE_SIZE_KYC = 20_971_520 // 20 MB
export const MAX_FILE_SIZE_DELIVERABLE = 104_857_600 // 100 MB
export const MAX_FILE_SIZE_MESSAGE_ATTACHMENT = 52_428_800 // 50 MB
export const MAX_FILE_SIZE_AVATAR = 5_242_880 // 5 MB

// Signed URL expiry (seconds)
export const SIGNED_URL_EXPIRY = 900 // 15 minutes
export const SIGNED_URL_EXPIRY_LONG = 3600 // 1 hour (for large downloads)

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100
export const DEFAULT_MESSAGE_LOAD = 50

// Session / Auth
export const INVITE_TOKEN_EXPIRY_HOURS = 48
export const SESSION_TIMEOUT_MINUTES = 60

// AI rate limits
export const AI_CALLS_PER_MINUTE = 10
export const AI_ASSISTANT_MAX_PER_SESSION = 5

// Onboarding
export const ONBOARDING_STEPS = [
  'company',
  'kyc',
  'services',
  'questionnaire',
  'review',
] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

// KYC
export const KYC_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const

// File storage R2 key prefixes
export const R2_PREFIXES = {
  KYC_QUARANTINE: 'quarantine/kyc',
  KYC: 'kyc',
  DOCUMENTS: 'documents',
  MESSAGES: 'messages',
  ONBOARDING: 'onboarding',
  INVOICES: 'invoices',
  AVATARS: 'avatars',
} as const
