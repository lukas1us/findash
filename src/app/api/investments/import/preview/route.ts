export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  detectCryptoFormat,
  parseBinance,
  parseCoinmateOrders,
  parseCoinmateHistory,
  parseCryptoComCrypto,
} from "@/lib/crypto-parsers";
import type { CryptoPreviewRow, CryptoFilePreview } from "@/lib/crypto-parsers/types";

export async function POST(request: Request) {
  const formData = await request.formData();
  const files    = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "Žádné soubory" }, { status: 400 });
  }

  const results: CryptoFilePreview[] = [];

  for (const file of files) {
    const text   = await file.text();
    const format = detectCryptoFormat(text);
    const warnings: string[] = [];

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
      results.push({
        filename: file.name, format, rows: [], totalCount: 0,
        toImportCount: 0, duplicateCount: 0, errorCount: 0,
        warnings: ["Nerozpoznaný formát CSV"],
      });
      continue;
    }

    // Collect unknown operation warnings
    const errorRows = rows.filter((r) => r.parseError);
    if (errorRows.length) {
      const msgs = Array.from(new Set(errorRows.map((r) => r.parseError!))).slice(0, 5);
      warnings.push(...msgs);
    }

    // Duplicate detection via @@unique([source, sourceId])
    const validRows   = rows.filter((r) => !r.parseError && r.sourceId);
    const sourceIds   = validRows.map((r) => r.sourceId!);
    const source      = validRows[0]?.source ?? "";

    if (sourceIds.length && source) {
      const existing = await prisma.cryptoTransaction.findMany({
        where: { source, sourceId: { in: sourceIds } },
        select: { sourceId: true },
      });
      const existingSet = new Set(existing.map((e) => e.sourceId));
      for (const row of validRows) {
        if (existingSet.has(row.sourceId!)) row.isDuplicate = true;
      }
    }

    const errorCount     = rows.filter((r) => !!r.parseError).length;
    const duplicateCount = rows.filter((r) => r.isDuplicate).length;
    const toImportCount  = rows.filter((r) => !r.parseError && !r.isDuplicate).length;

    results.push({
      filename: file.name,
      format,
      rows,
      totalCount:     rows.length,
      toImportCount,
      duplicateCount,
      errorCount,
      warnings,
    });
  }

  return NextResponse.json(results);
}
