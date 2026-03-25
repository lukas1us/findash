import Papa from "papaparse";
import type { InvestmentPreviewRow } from "./types";
import { parseAmount } from "./amount-parser";
import { parseDate } from "./date-parser";

interface CryptoComRow {
  "Timestamp (UTC)": string;
  "Transaction Description": string;
  Currency: string;
  Amount: string;
  "To Currency": string;
  "To Amount": string;
  "Native Currency": string;
  "Native Amount": string;
  "Native Amount (in USD)": string;
  "Transaction Kind": string;
  [key: string]: string;
}

// Only these kinds map cleanly to BUY purchases
const BUY_KINDS = new Set([
  "crypto_purchase",
  "viban_purchase",
  "crypto_deposit",
  "exchange",
]);

export function parseCryptoCom(csvText: string): InvestmentPreviewRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  const result = Papa.parse<CryptoComRow>(text, {
    header: true,
    delimiter: ",",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const rows: InvestmentPreviewRow[] = [];

  result.data.forEach((row, i) => {
    const kind = (row["Transaction Kind"] ?? "").toLowerCase().trim();

    if (!BUY_KINDS.has(kind)) return;

    const rawDate      = row["Timestamp (UTC)"];
    const currency     = (row["Currency"] ?? "").toUpperCase();
    const rawAmount    = row["Amount"];
    const rawNative    = row["Native Amount"];
    const nativeCur    = (row["Native Currency"] ?? "CZK").toUpperCase();

    if (!rawDate || !currency || !rawAmount) {
      rows.push({ rowIndex: i, date: "", ticker: currency, quantity: 0, pricePerUnit: 0, fees: 0, action: "BUY", parseError: "Chybí povinné sloupce" });
      return;
    }

    const date = parseDate(rawDate);
    if (!date) {
      rows.push({ rowIndex: i, date: "", ticker: currency, quantity: 0, pricePerUnit: 0, fees: 0, action: "BUY", parseError: `Neparsovatelné datum: ${rawDate}` });
      return;
    }

    const quantity   = Math.abs(parseAmount(rawAmount));
    const nativeAmt  = Math.abs(parseAmount(rawNative ?? "0"));

    // Price per unit in native currency
    const pricePerUnit = quantity > 0 ? nativeAmt / quantity : 0;

    // Note: if nativeCur != "CZK", the price will be in foreign currency.
    // The preview route will flag this and offer FX conversion.
    const sourceId = `${rawDate}|${currency}|${rawAmount}|${kind}`;

    rows.push({
      rowIndex: i,
      date,
      ticker: currency,
      quantity,
      pricePerUnit,    // in nativeCur (may not be CZK)
      fees: 0,         // Crypto.com doesn't expose fees in this format
      action: "BUY",
      description: row["Transaction Description"] || undefined,
      externalId: sourceId,
    });
  });

  return rows;
}
