-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "importId" TEXT,
ADD COLUMN "importSource" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_importId_key" ON "Transaction"("importId");
