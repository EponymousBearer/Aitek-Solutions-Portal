-- Remove the Invoices feature entirely (model, enum, notification type + pref).
-- No invoices were ever created, so the NotificationType enum recreation and the
-- invoices table drop touch no live rows.

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('KYC_STATUS_CHANGED', 'PROJECT_CREATED', 'MILESTONE_SUBMITTED', 'MILESTONE_APPROVED', 'MILESTONE_REJECTED', 'MESSAGE_RECEIVED', 'MESSAGE_MENTION', 'DOCUMENT_UPLOADED', 'AGREEMENT_SENT', 'AGREEMENT_ACKNOWLEDGED', 'ONBOARDING_COMPLETED', 'TEAM_MEMBER_INVITED', 'CUSTOM_REQUEST_RECEIVED');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_companyId_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_projectId_fkey";

-- AlterTable
ALTER TABLE "notification_preferences" DROP COLUMN "emailOnInvoice";

-- DropTable
DROP TABLE "invoices";

-- DropEnum
DROP TYPE "InvoiceStatus";
