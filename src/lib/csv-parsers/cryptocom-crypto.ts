import Papa from "papaparse";
import type { CryptoTxRow, CryptoTxType } from "./crypto-types";
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
  "Transaction Hash": string;
  [key: string]: string;
}

const SKIP_KINDS_PREFIXES = ["crypto_transfer", "dust_conversion"];

function getType(kind: string): CryptoTxType | null {
  const k = kind.toLowerCase();

  if (SKIP_KINDS_PREFIXES.some((p) => k.startsWith(p))) return null;

  if (k === "viban_purchase" || k === "crypto_purchase" || k === "exchange") return "BUY";
  if (k === "crypto_viban_exchange") return "SWAP";
  if (k === "crypto_deposit") return "DEPOSIT";
  if (k === "crypto_withdrawal") return "WITHDRAWAL";

  // Reward-like patterns
  if (
    k.includes("interest") ||
    k.includes("reward") ||
    k.includes("cashback") ||
    k.includes("earn") ||
    k.startsWith("finance.")
  ) {
    return "REWARD";
  }

  return null; // skip unknown kinds
}

export function parseCryptoComFull(csvText: string): CryptoTxRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  const result = Papa.parse<CryptoComRow>(text, {
    header: true,
    delimiter: ",",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const rows: CryptoTxRow[] = [];

  result.data.forEach((row, i) => {
    const kind = (row["Transaction Kind"] ?? "").trim();
    const type = getType(kind);
    if (type === null) return;

    const rawDate = row["Timestamp (UTC)"];
    const date = parseDate(rawDate);
    if (!date) return;

    let ticker: string;
    let quantity: number;

    if (type === "BUY" && row["To Currency"]) {
      // viban_purchase: Currency=EUR (spent), To Currency=ADA (received)
      ticker = (row["To Currency"] ?? "").toUpperCase();
      quantity = Math.abs(parseAmount(row["To Amount"]));
    } else {
      ticker = (row["Currency"] ?? "").toUpperCase();
      quantity = Math.abs(parseAmount(row["Amount"]));
    }

    const nativeAmt = Math.abs(parseAmount(row["Native Amount"] || "0"));
    const nativeCur = (row["Native Currency"] ?? "").toUpperCase();
    const totalCZK = nativeCur === "CZK" ? nativeAmt : 0;
    const pricePerUnit = quantity > 0 && totalCZK > 0 ? totalCZK / quantity : 0;

    const sourceId = `${rawDate}|${ticker}|${row["Amount"]}|${kind}`;

    rows.push({
      rowIndex: i,
      date,
      type,
      ticker,
      quantity,
      pricePerUnit,
      totalCZK,
      fee: 0,
      feeCurrency: "",
      source: "CRYPTO_COM",
      sourceId,
      notes: row["Transaction Description"] || undefined,
    });
  });

  return rows;
}
