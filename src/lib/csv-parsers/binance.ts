import Papa from "papaparse";
import type { CryptoTxRow, CryptoTxType } from "./crypto-types";
import { parseDate } from "./date-parser";

interface BinanceRow {
  User_ID: string;
  UTC_Time: string;
  Account: string;
  Operation: string;
  Coin: string;
  Change: string;
  Remark: string;
}

const SKIP_OPERATIONS = new Set([
  "p2p trading",
  "transfer between",
  "withdraw",
  "transaction fee",
  "transaction spend",
]);

function isReward(op: string): boolean {
  return op.includes("interest") || op.includes("reward") || op.includes("savings distribution");
}

export function parseBinance(csvText: string): CryptoTxRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  const result = Papa.parse<BinanceRow>(text, {
    header: true,
    delimiter: ",",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const rows: CryptoTxRow[] = [];

  result.data.forEach((row, i) => {
    const operation = (row.Operation ?? "").trim();
    const opLower = operation.toLowerCase();
    const ticker = (row.Coin ?? "").toUpperCase();
    const changeStr = row.Change ?? "0";
    const change = parseFloat(changeStr) || 0;

    if (SKIP_OPERATIONS.has(opLower)) return;

    let type: CryptoTxType;

    if (isReward(opLower)) {
      type = "REWARD";
    } else if (opLower === "deposit") {
      type = "DEPOSIT";
    } else if (opLower === "transaction buy" || opLower === "buy") {
      type = "BUY";
    } else if (opLower === "sell" || opLower === "transaction sold") {
      type = "SELL";
    } else if (opLower === "binance convert" || opLower === "transaction revenue") {
      type = "SWAP";
    } else {
      return; // unknown operation, skip
    }

    // SELL records the outgoing crypto (negative Change); all others are incoming (positive)
    if (type === "SELL" && change >= 0) return;
    if (type !== "SELL" && change <= 0) return;

    const date = parseDate(row.UTC_Time);
    if (!date) return;

    const quantity = Math.abs(change);
    const sourceId = `${row.UTC_Time}|${ticker}|${changeStr}|${opLower}`;

    rows.push({
      rowIndex: i,
      date,
      type,
      ticker,
      quantity,
      pricePerUnit: 0,
      totalCZK: 0,
      fee: 0,
      feeCurrency: "",
      source: "BINANCE",
      sourceId,
    });
  });

  return rows;
}
