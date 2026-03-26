import Papa from "papaparse";
import type { CryptoPreviewRow, CryptoTxType } from "./types";
import { FIAT_TICKERS } from "./types";
import { parseAmount } from "../csv-parsers/amount-parser";
import { parseDate } from "../csv-parsers/date-parser";

interface BinanceRow {
  User_ID:   string;
  UTC_Time:  string;
  Account:   string;
  Operation: string;
  Coin:      string;
  Change:    string;
  Remark:    string;
  [key: string]: string;
}

const DIRECT_OP: Record<string, CryptoTxType> = {
  Buy:                  "BUY",
  Sell:                 "SELL",
  Deposit:              "DEPOSIT",
  Withdrawal:           "WITHDRAWAL",
  "POS savings interest": "REWARD",
  "Savings Interest":   "REWARD",
  "Staking Rewards":    "REWARD",
};

const SWAP_OPS = new Set(["Binance Convert", "Transaction Spend", "Transaction Revenue"]);
const SKIP_OPS = new Set([
  "P2P Trading",
  "Transfer Between Main Account/Futures and Margin Account",
]);

export function parseBinance(csvText: string): CryptoPreviewRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  const result = Papa.parse<BinanceRow>(text, {
    header:      true,
    delimiter:   ",",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().replace(/^"(.*)"$/, "$1"),
    transform:   (v) => v.trim().replace(/^"(.*)"$/, "$1"),
  });

  const rows: CryptoPreviewRow[] = [];

  // Separate swap-eligible rows; process direct ops immediately
  const swapCandidates: BinanceRow[] = [];

  result.data.forEach((row) => {
    const op = row.Operation?.trim() ?? "";
    if (SKIP_OPS.has(op)) return;
    if (SWAP_OPS.has(op)) {
      swapCandidates.push(row);
    }
  });

  // Process direct operations
  result.data.forEach((row, i) => {
    const op     = row.Operation?.trim() ?? "";
    const coin   = (row.Coin ?? "").trim().toUpperCase();
    const change = parseAmount(row.Change);
    const date   = parseDate(row.UTC_Time);

    if (SKIP_OPS.has(op)) return;
    if (SWAP_OPS.has(op)) return; // handled below

    const txType = DIRECT_OP[op];
    if (!txType) {
      rows.push({
        rowIndex: i, date: date || "", ticker: coin, quantity: 0, type: "BUY",
        source: "BINANCE",
        sourceId: `${row.UTC_Time}|${coin}|${row.Change}`,
        parseError: `Neznámá operace: ${op}`,
      });
      return;
    }

    if (!date) {
      rows.push({
        rowIndex: i, date: "", ticker: coin, quantity: 0, type: txType,
        source: "BINANCE",
        sourceId: `${row.UTC_Time}|${coin}|${row.Change}`,
        parseError: `Neparsovatelné datum: ${row.UTC_Time}`,
      });
      return;
    }

    // For BUY/SELL, fiat spend/receive rows are noise — skip them
    if ((txType === "BUY" || txType === "SELL") && FIAT_TICKERS.has(coin)) return;

    const quantity = txType === "SELL" || txType === "WITHDRAWAL"
      ? -Math.abs(change)
      : Math.abs(change);

    rows.push({
      rowIndex: i,
      date,
      type: txType,
      ticker: coin,
      quantity,
      source: "BINANCE",
      sourceId: `${row.UTC_Time}|${coin}|${row.Change}`,
      notes: row.Remark || undefined,
    });
  });

  // Process SWAP groups: pair by exact UTC_Time
  const byTime = new Map<string, BinanceRow[]>();
  for (const row of swapCandidates) {
    const key = row.UTC_Time?.trim() ?? "";
    if (!byTime.has(key)) byTime.set(key, []);
    byTime.get(key)!.push(row);
  }

  let rowIndex = result.data.length; // continue from after direct rows

  for (const [time, group] of Array.from(byTime)) {
    const date = parseDate(time);
    if (!date) continue;

    const crypto = group.filter((r: BinanceRow) => !FIAT_TICKERS.has(r.Coin?.toUpperCase() ?? ""));
    const fiat   = group.filter((r: BinanceRow) =>  FIAT_TICKERS.has(r.Coin?.toUpperCase() ?? ""));

    for (const r of group) {
      const coin   = (r.Coin ?? "").trim().toUpperCase();
      const change = parseAmount(r.Change);
      if (!coin) continue;

      // Compute totalCZK from the fiat side of the pair
      const fiatRow  = fiat.find(() => true);
      const fiatAmt  = fiatRow ? Math.abs(parseAmount(fiatRow.Change)) : undefined;
      const isCZK    = fiatRow?.Coin?.toUpperCase() === "CZK";

      let pricePerUnit: number | undefined;
      let totalCZK:     number | undefined;

      if (fiatAmt && isCZK && !FIAT_TICKERS.has(coin)) {
        totalCZK     = fiatAmt;
        const qty    = Math.abs(change);
        pricePerUnit = qty > 0 ? fiatAmt / qty : undefined;
      }

      // Skip fiat rows — record only the crypto side
      if (FIAT_TICKERS.has(coin)) continue;

      rows.push({
        rowIndex: rowIndex++,
        date,
        type: "SWAP",
        ticker: coin,
        quantity: change, // keeps sign: negative = sent, positive = received
        pricePerUnit,
        totalCZK,
        source: "BINANCE",
        sourceId: `${time}|${coin}|${r.Change}`,
        notes: r.Remark || undefined,
      });
    }
  }

  return rows;
}
