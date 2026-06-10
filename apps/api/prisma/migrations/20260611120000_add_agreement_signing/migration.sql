-- Agreement signing: typed body + optional document file + drawn signature.

-- DropForeignKey
ALTER TABLE "agreements" DROP CONSTRAINT "agreements_documentId_fkey";

-- AlterTable
ALTER TABLE "agreements" ADD COLUMN     "body" TEXT,
ALTER COLUMN "documentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "agreement_audit_records" ADD COLUMN     "signatureImage" TEXT;

-- CreateIndex
CREATE INDEX "agreements_projectId_idx" ON "agreements"("projectId");

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
