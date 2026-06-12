-- Files attached to a deliverable (stored on local disk; several per deliverable).

-- CreateTable
CREATE TABLE "deliverable_files" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliverable_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deliverable_files_deliverableId_idx" ON "deliverable_files"("deliverableId");

-- AddForeignKey
ALTER TABLE "deliverable_files" ADD CONSTRAINT "deliverable_files_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
