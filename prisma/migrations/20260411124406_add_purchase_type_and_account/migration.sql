-- CreateEnum
CREATE TYPE "CryptoTxType" AS ENUM ('BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL', 'REWARD', 'SWAP');

-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('BUY', 'SELL');

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "type" "PurchaseType" NOT NULL DEFAULT 'BUY';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "exchangeRate" DOUBLE PRECISION,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "originalAmount" DOUBLE PRECISION,
ADD COLUMN     "originalCurrency" TEXT;

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL DEFAULT 'CZK',
    "rate" DOUBLE PRECISION NOT NULL,
    "date" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ECB',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoTransaction" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "CryptoTxType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "pricePerUnit" DOUBLE PRECISION,
    "totalCZK" DOUBLE PRECISION,
    "fee" DOUBLE PRECISION,
    "feeCurrency" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CryptoTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_fromCurrency_toCurrency_date_key" ON "ExchangeRate"("fromCurrency", "toCurrency", "date");

-- CreateIndex
CREATE INDEX "CryptoTransaction_assetId_idx" ON "CryptoTransaction"("assetId");

-- CreateIndex
CREATE INDEX "CryptoTransaction_date_idx" ON "CryptoTransaction"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoTransaction_source_sourceId_key" ON "CryptoTransaction"("source", "sourceId");

-- CreateIndex
CREATE INDEX "Purchase_externalId_idx" ON "Purchase"("externalId");

-- CreateIndex
CREATE INDEX "Transaction_externalId_idx" ON "Transaction"("externalId");

-- AddForeignKey
ALTER TABLE "CryptoTransaction" ADD CONSTRAINT "CryptoTransaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
