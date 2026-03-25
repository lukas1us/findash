import Papa from "papaparse";
import type { FinancePreviewRow } from "./types";
import { parseAmount } from "./amount-parser";
import { parseDate } from "./date-parser";

interface RevolutRow {
  Type: string;
  Product: string;
  "Started Date": string;
  "Completed Date": string;
  Description: string;
  Amount: string;
  Fee: string;
  Currency: string;
  State: string;
  Balance: string;
  [key: string]: string;
}

export function parseRevolut(csvText: string): FinancePreviewRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  const result = Papa.parse<RevolutRow>(text, {
    header: true,
    delimiter: ",",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const rows: FinancePreviewRow[] = [];
  let rowIndex = 0;

  for (const row of result.data) {
    // Only completed transactions
    if (row["State"]?.toUpperCase() !== "COMPLETED") continue;

    const rawAmount    = row["Amount"];
    const rawCompleted = row["Completed Date"];
    const rawStarted   = row["Started Date"];
    const currency     = row["Currency"] ?? "CZK";

    if (!rawAmount || !rawCompleted) {
      rows.push({ rowIndex: rowIndex++, date: "", amount: 0, type: "EXPENSE", description: "", parseError: "Chybí sloupce Amount/Completed Date" });
      continue;
    }

    const amount = parseAmount(rawAmount);
    const date   = parseDate(rawCompleted);
    const fee    = parseAmount(row["Fee"] ?? "0");

    if (!date) {
      rows.push({ rowIndex: rowIndex++, date: "", amount: 0, type: "EXPENSE", description: "", parseError: `Neparsovatelné datum: ${rawCompleted}` });
      continue;
    }

    const description = row["Description"] || "Revolut transakce";
    const sourceId    = `${rawStarted}|${rawAmount}|${description}`;

    const baseRow: FinancePreviewRow = {
      rowIndex: rowIndex++,
      date,
      amount: Math.abs(amount),
      type: amount < 0 ? "EXPENSE" : "INCOME",
      description,
      externalId: sourceId,
      // FX fields — rates will be populated in the preview route
      ...(currency !== "CZK" ? { originalCurrency: currency, originalAmount: amount } : {}),
    };
    rows.push(baseRow);

    // Companion fee row
    if (fee > 0) {
      rows.push({
        rowIndex: rowIndex++,
        date,
        amount: fee,
        type: "EXPENSE",
        description: `Poplatek: ${description}`,
        externalId: `${sourceId}|fee`,
        isFeeRow: true,
        ...(currency !== "CZK" ? { originalCurrency: currency, originalAmount: fee } : {}),
      });
    }
  }

  return rows;
}
