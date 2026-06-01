-- CreateEnum
CREATE TYPE "OnboardingPhase" AS ENUM ('COMPANY', 'KYC', 'SERVICES', 'QUESTIONNAIRE', 'REVIEW', 'SUBMITTED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "onboardingPhase" "OnboardingPhase" NOT NULL DEFAULT 'COMPANY',
ADD COLUMN     "submittedForReviewAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "companies_onboardingPhase_idx" ON "companies"("onboardingPhase");

-- Backfill: companies that already finished onboarding under the old flow
-- (a COMPLETED onboarding session) are treated as submitted for review. Others
-- keep the default COMPANY phase and resume from the start.
UPDATE "companies" c
SET "onboardingPhase" = 'SUBMITTED',
    "submittedForReviewAt" = COALESCE(c."updatedAt", CURRENT_TIMESTAMP)
WHERE EXISTS (
  SELECT 1 FROM "onboarding_sessions" s
  WHERE s."companyId" = c."id" AND s."status" = 'COMPLETED'
);
