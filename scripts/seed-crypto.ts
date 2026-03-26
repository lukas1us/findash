import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  detectCryptoFormat,
  parseBinance,
  parseCoinmateOrders,
  parseCoinmateHistory,
  parseCryptoComCrypto,
} from "../src/lib/crypto-parsers";
import type { CryptoPreviewRow } from "../src/lib/crypto-parsers/types";

// ─── Prisma setup ─────────────────────────────────────────────────────────────

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ─── Seed ─────────────────────────────────────────────────────────────────────

const MOCK_DIR = path.join(__dirname, "..", "mock_csvs");

async function main() {
  const files = fs.readdirSync(MOCK_DIR).filter((f) => f.endsWith(".csv"));

  if (files.length === 0) {
    console.log("No CSV files found in mock_csvs/. Add some files and re-run.");
    return;
  }

  const summary: Record<string, { imported: number; skipped: number; errors: string[] }> = {};

  for (const filename of files) {
    const filePath = path.join(MOCK_DIR, filename);
    const text = fs.readFileSync(filePath, "utf-8");
    const format = detectCryptoFormat(text);

    let rows: CryptoPreviewRow[] = [];

    if (format === "binance") {
      rows = parseBinance(text);
    } else if (format === "coinmate_orders") {
      rows = parseCoinmateOrders(text);
    } else if (format === "coinmate_history") {
      rows = parseCoinmateHistory(text);
    } else if (format === "cryptocom") {
      rows = parseCryptoComCrypto(text);
    } else {
      console.warn(`[SKIP] ${filename}: unrecognized format`);
      continue;
    }

    console.log(`[${format.toUpperCase()}] ${filename}: ${rows.length} rows parsed`);

    // Resolve / create asset for each ticker
    const tickerToAssetId: Record<string, string> = {};
    const tickers = Array.from(new Set(rows.filter((r) => !r.parseError).map((r) => r.ticker)));

    for (const ticker of tickers) {
      let asset = await prisma.asset.findFirst({
        where: { ticker: { equals: ticker, mode: "insensitive" } },
      });
      if (!asset) {
        asset = await prisma.asset.create({
          data: {
            name: ticker,
            ticker: ticker.toUpperCase(),
            type: "CRYPTO",
            currency: "CZK",
          },
        });
        console.log(`  Created asset: ${ticker}`);
      }
      tickerToAssetId[ticker] = asset.id;
    }

    // Import rows
    if (!summary[filename]) summary[filename] = { imported: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      if (row.parseError) {
        summary[filename].skipped++;
        continue;
      }

      const assetId = tickerToAssetId[row.ticker];
      if (!assetId) {
        summary[filename].errors.push(`Unknown ticker: ${row.ticker}`);
        summary[filename].skipped++;
        continue;
      }

      try {
        await prisma.cryptoTransaction.create({
          data: {
            assetId,
            type: row.type,
            date: new Date(row.date + "T00:00:00Z"),
            quantity: row.quantity,
            pricePerUnit: row.pricePerUnit ?? null,
            totalCZK: row.totalCZK ?? null,
            fee: row.fee ?? null,
            feeCurrency: row.feeCurrency ?? null,
            source: row.source,
            sourceId: row.sourceId ?? null,
            notes: row.notes ?? null,
          },
        });
        summary[filename].imported++;
      } catch (err: unknown) {
        // P2002 = unique constraint violation (duplicate) — skip silently
        if ((err as { code?: string }).code === "P2002") {
          summary[filename].skipped++;
        } else {
          summary[filename].errors.push(`${row.date} ${row.ticker}: ${String(err)}`);
          summary[filename].skipped++;
        }
      }
    }
  }

  // Print summary
  console.log("\n── Seed summary ──────────────────────────────────");
  for (const [file, s] of Object.entries(summary)) {
    console.log(`${file}: imported=${s.imported}, skipped=${s.skipped}, errors=${s.errors.length}`);
    for (const e of s.errors) console.log(`  ERROR: ${e}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
