-- CreateEnum
CREATE TYPE "AitekRole" AS ENUM ('PROJECT_MANAGER', 'DEVELOPER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "aitekRole" "AitekRole";

-- AlterTable
ALTER TABLE "project_memberships" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT;

-- CreateIndex
CREATE INDEX "project_memberships_isActive_idx" ON "project_memberships"("isActive");
