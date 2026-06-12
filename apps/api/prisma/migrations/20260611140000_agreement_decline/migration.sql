-- Agreement decline: a new notification type + the reason the client gave.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'AGREEMENT_DECLINED';

-- AlterTable
ALTER TABLE "agreements" ADD COLUMN     "declineReason" TEXT;
