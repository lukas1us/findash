import Papa from "papaparse";
import type { CryptoPreviewRow, CryptoTxType } from "./types";
import { parseAmount } from "../csv-parsers/amount-parser";
import { parseDate } from "../csv-parsers/date-parser";

interface CryptoComRow {
  "Timestamp (UTC)":          string;
  "Transaction Description":  string;
  Currency:                   string;
  Amount:                     string;
  "To Currency":              string;
  "To Amount":                string;
  "Native Currency":          string;
  "Native Amount":            string;
  "Native Amount (in USD)":   string;
  "Transaction Kind":         string;
  "Transaction Hash":         string;
  [key: string]: string;
}

type KindMapping = CryptoTxType | "SKIP";

const KIND_MAP: Record<string, KindMapping> = {
  crypto_purchase:    "BUY",
  viban_purchase:     "BUY",
  crypto_withdrawal:  "WITHDRAWAL",
  crypto_deposit:     "DEPOSIT",
  exchange:           "SWAP",
  "finance.dpos.non_compound_interest.crypto_wallet": "REWARD",
  referral_card_cashback: "REWARD",
  mco_stake_reward:   "REWARD",
  crypto_transfer:    "SKIP",
  dust_conversion_debited:  "SKIP",
  dust_conversion_credited: "SKIP",
};

export function parseCryptoComCrypto(csvText: string): CryptoPreviewRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  const result = Papa.parse<CryptoComRow>(text, {
    header:      true,
    delimiter:   ",",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform:   (v) => v.trim(),
  });

  const rows: CryptoPreviewRow[] = [];

  result.data.forEach((row, i) => {
    const kind       = (row["Transaction Kind"] ?? "").toLowerCase().trim();
    const txTypeRaw  = KIND_MAP[kind];
    if (!txTypeRaw || txTypeRaw === "SKIP") return;
    const txType     = txTypeRaw;

    const rawDate  = row["Timestamp (UTC)"]?.trim();
    const date     = parseDate(rawDate);
    if (!date) {
      rows.push({ rowIndex: i, date: "", ticker: "", quantity: 0, type: txType, source: "CRYPTO_COM", parseError: `Neparsovatelné datum: ${rawDate}` });
      return;
    }

    const currency   = (row["Currency"] ?? "").toUpperCase().trim();
    const amount     = parseAmount(row["Amount"]);
    const nativeAmt  = parseAmount(row["Native Amount"]);
    const nativeCur  = (row["Native Currency"] ?? "CZK").toUpperCase();

    // Use Native Amount as CZK if native currency is CZK
    const totalCZK   = nativeCur === "CZK" ? Math.abs(nativeAmt) : undefined;
    const qty        = Math.abs(amount);
    const pricePerUnit = (totalCZK && qty > 0) ? totalCZK / qty : undefined;

    const isSend = txType === "SELL" || txType === "WITHDRAWAL";
    const quantity = isSend ? -qty : qty;

    const sourceId = `${rawDate}|${currency}|${row["Amount"]}|${kind}`;

    rows.push({
      rowIndex: i,
      date,
      type: txType,
      ticker: currency,
      quantity,
      pricePerUnit,
      totalCZK,
      source: "CRYPTO_COM",
      sourceId,
      notes: row["Transaction Description"] || undefined,
    });
  });

  return rows;
}
