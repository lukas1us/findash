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

const BUY_OPS = new Set(["buy", "transaction buy"]);
const SELL_OPS = new Set(["sell", "transaction sold"]);

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
    const opLower = (row.Operation ?? "").trim().toLowerCase();
    const ticker = (row.Coin ?? "").toUpperCase();
    const changeStr = row.Change ?? "0";
    const change = parseFloat(changeStr) || 0;

    let type: CryptoTxType;

    if (BUY_OPS.has(opLower)) {
      type = "BUY";
    } else if (SELL_OPS.has(opLower)) {
      type = "SELL";
    } else {
      return; // discard everything else
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
