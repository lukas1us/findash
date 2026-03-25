export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  detectFormat,
  parseAirBank,
  parseRevolut,
  parseCoinmate,
  parseCryptoCom,
  fetchECBRate,
} from "@/lib/csv-parsers";
import type {
  FinancePreviewRow,
  InvestmentPreviewRow,
  PreviewResult,
} from "@/lib/csv-parsers/types";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Soubor nebyl přiložen" }, { status: 400 });
  }

  const text = await file.text();
  const format = detectFormat(text);

  if (format === "unknown") {
    return NextResponse.json({ error: "Nerozpoznaný formát CSV" }, { status: 422 });
  }

  const module = format === "airbank" || format === "revolut" ? "finance" : "investments";
  const warnings: string[] = [];

  let financeRows: FinancePreviewRow[] = [];
  let investmentRows: InvestmentPreviewRow[] = [];

  // ── Parse ──────────────────────────────────────────────────────────────────
  if (format === "airbank") {
    financeRows = parseAirBank(text);
  } else if (format === "revolut") {
    financeRows = parseRevolut(text);

    // Fetch ECB rates for non-CZK rows
    const foreignRows = financeRows.filter(
      (r) => !r.parseError && r.originalCurrency && r.originalCurrency !== "CZK"
    );
    const uniqueCurrencies = Array.from(new Set(foreignRows.map((r) => r.originalCurrency!)));

    for (const row of foreignRows) {
      if (!row.originalCurrency || !row.originalAmount) continue;
      const rate = await fetchECBRate(row.originalCurrency, row.date);
      if (rate) {
        row.exchangeRate = rate;
        row.amount = Math.abs(row.originalAmount * rate);
      } else {
        warnings.push(
          `Nepodařilo se načíst kurz ${row.originalCurrency}/CZK pro ${row.date} — zadejte kurz ručně`
        );
      }
    }

    if (uniqueCurrencies.length > 0) {
      warnings.push(
        `Nalezeny transakce v cizí měně: ${uniqueCurrencies.join(", ")}. Kurzy ECB byly načteny automaticky.`
      );
    }
  } else if (format === "coinmate") {
    investmentRows = parseCoinmate(text);
  } else {
    investmentRows = parseCryptoCom(text);
  }

  // ── Duplicate detection ───────────────────────────────────────────────────
  if (module === "finance") {
    const externalIds = financeRows
      .filter((r) => r.externalId)
      .map((r) => r.externalId!);

    if (externalIds.length > 0) {
      const existing = await prisma.transaction.findMany({
        where: { externalId: { in: externalIds } },
        select: { externalId: true },
      });
      const existingSet = new Set(existing.map((t) => t.externalId));
      for (const row of financeRows) {
        if (row.externalId && existingSet.has(row.externalId)) {
          row.isDuplicate = true;
        }
      }
    }

    // For rows without externalId (Revolut): check by date+amount+description
    const noIdRows = financeRows.filter((r) => !r.externalId && !r.parseError);
    for (const row of noIdRows) {
      const dateObj = new Date(row.date + "T00:00:00Z");
      const exists = await prisma.transaction.findFirst({
        where: {
          date: { gte: dateObj, lt: new Date(dateObj.getTime() + 86400000) },
          amount: row.amount,
          description: row.description,
        },
        select: { id: true },
      });
      if (exists) row.isDuplicate = true;
    }
  } else {
    const externalIds = investmentRows
      .filter((r) => r.externalId)
      .map((r) => r.externalId!);

    if (externalIds.length > 0) {
      const existing = await prisma.purchase.findMany({
        where: { externalId: { in: externalIds } },
        select: { externalId: true },
      });
      const existingSet = new Set(existing.map((p) => p.externalId));
      for (const row of investmentRows) {
        if (row.externalId && existingSet.has(row.externalId)) {
          row.isDuplicate = true;
        }
      }
    }
  }

  const errorCount = [
    ...financeRows,
    ...investmentRows,
  ].filter((r) => r.parseError).length;

  const tickers = Array.from(new Set(investmentRows.filter((r) => !r.parseError).map((r) => r.ticker)));
  const currencies = Array.from(new Set(
    financeRows
      .filter((r) => r.originalCurrency && r.originalCurrency !== "CZK")
      .map((r) => r.originalCurrency!)
  ));

  const result: PreviewResult = {
    format,
    module,
    financeRows,
    investmentRows,
    tickers,
    currencies,
    errorCount,
    warnings,
  };

  return NextResponse.json(result);
}
