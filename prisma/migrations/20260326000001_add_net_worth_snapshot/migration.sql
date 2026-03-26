-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "cashTotal" DECIMAL(12,2) NOT NULL,
    "investmentsTotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetWorthSnapshot_date_key" ON "NetWorthSnapshot"("date");
