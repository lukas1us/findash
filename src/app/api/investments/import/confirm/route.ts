export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { CryptoPreviewRow } from "@/lib/crypto-parsers/types";

interface ConfirmBody {
  rows:               CryptoPreviewRow[];
  assetMapping:       Record<string, string>; // ticker → assetId (or "" to auto-create)
  // Optional: if provided, a finance Transaction is created for each BUY/SELL/REWARD row
  accountId?:         string;
  expenseCategoryId?: string; // used for BUY
  incomeCategoryId?:  string; // used for SELL, REWARD
}

interface SourceSummary {
  imported: number;
  skipped:  number;
  errors:   string[];
}

export async function POST(request: Request) {
  const body: ConfirmBody = await request.json();
  const { rows, assetMapping = {}, accountId, expenseCategoryId, incomeCategoryId } = body;

  const bookToAccount = !!(accountId && (expenseCategoryId || incomeCategoryId));

  const summary: Record<string, SourceSummary> = {};

  // Resolve / create assets for all tickers
  const tickerToAssetId: Record<string, string> = { ...assetMapping };

  const tickers = Array.from(new Set(rows.filter((r) => !r.parseError).map((r) => r.ticker)));
  for (const ticker of tickers) {
    if (tickerToAssetId[ticker]) continue;

    let asset = await prisma.asset.findFirst({
      where: { ticker: { equals: ticker, mode: "insensitive" } },
    });

    if (!asset) {
      asset = await prisma.asset.create({
        data: {
          name:     ticker,
          ticker:   ticker.toUpperCase(),
          type:     "CRYPTO",
          currency: "CZK",
        },
      });
    }
    tickerToAssetId[ticker] = asset.id;
  }

  // Import rows
  for (const row of rows) {
    if (row.parseError) continue;

    const src = row.source;
    if (!summary[src]) summary[src] = { imported: 0, skipped: 0, errors: [] };

    const assetId = tickerToAssetId[row.ticker];
    if (!assetId) {
      summary[src].errors.push(`Neznámý ticker: ${row.ticker}`);
      summary[src].skipped++;
      continue;
    }

    try {
      await prisma.cryptoTransaction.create({
        data: {
          assetId,
          type:         row.type,
          date:         new Date(row.date + "T00:00:00Z"),
          quantity:     row.quantity,
          pricePerUnit: row.pricePerUnit ?? null,
          totalCZK:     row.totalCZK    ?? null,
          fee:          row.fee         ?? null,
          feeCurrency:  row.feeCurrency ?? null,
          source:       row.source,
          sourceId:     row.sourceId    ?? null,
          notes:        row.notes       ?? null,
        },
      });

      // Optionally create a finance transaction
      if (bookToAccount) {
        const txType = row.type === "BUY"  ? "EXPENSE"
                     : row.type === "SELL" ? "INCOME"
                     : row.type === "REWARD" ? "INCOME"
                     : null;

        const categoryId = txType === "EXPENSE" ? expenseCategoryId
                         : txType === "INCOME"  ? incomeCategoryId
                         : null;

        if (txType && categoryId) {
          const amount = row.totalCZK
            ?? (Math.abs(row.quantity) * (row.pricePerUnit ?? 0));

          const importId = row.sourceId
            ? `crypto_${row.source}_${row.sourceId}`
            : null;

          await prisma.transaction.create({
            data: {
              accountId:    accountId!,
              categoryId,
              type:         txType,
              amount,
              date:         new Date(row.date + "T00:00:00Z"),
              description:  `${row.type} ${row.ticker}`,
              importId:     importId ?? undefined,
              importSource: row.source,
            },
          });

          // Adjust account balance
          await prisma.account.update({
            where: { id: accountId! },
            data:  { balance: { increment: txType === "INCOME" ? amount : -amount } },
          });
        }
      }

      summary[src].imported++;
    } catch (err: unknown) {
      // Unique constraint violation = duplicate → skip silently
      if ((err as { code?: string }).code === "P2002") {
        summary[src].skipped++;
      } else {
        summary[src].errors.push(`${row.date} ${row.ticker}: ${String(err)}`);
        summary[src].skipped++;
      }
    }
  }

  return NextResponse.json({ summary });
}
