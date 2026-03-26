import Papa from "papaparse";
import type { CryptoPreviewRow } from "./types";
import { parseAmount } from "../csv-parsers/amount-parser";
import { parseDate } from "../csv-parsers/date-parser";

interface CoinmateOrderRow {
  "ORDER ID":    string;
  "DATE OPENED": string;
  TYPE:          string;
  PAIR:          string;
  "ORIG. SIZE":  string;
  PRICE:         string;
  "ORDER TOTAL": string;
  "DATE FILLED": string;
  STATUS:        string;
  [key: string]: string;
}

export function parseCoinmateOrders(csvText: string): CryptoPreviewRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  // Detect delimiter
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const delimiter = firstLine.includes(";") ? ";" : ",";

  const result = Papa.parse<CoinmateOrderRow>(text, {
    header:      true,
    delimiter,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform:   (v) => v.trim(),
  });

  const rows: CryptoPreviewRow[] = [];

  result.data.forEach((row, i) => {
    const status = (row["STATUS"] ?? "").toUpperCase();
    if (status !== "FILLED") return;

    const orderId = row["ORDER ID"]?.trim();
    const type    = (row["TYPE"] ?? "").toUpperCase() as "BUY" | "SELL";
    const pair    = (row["PAIR"] ?? "").toUpperCase();      // e.g. "ADA_CZK"
    const dateFilled = row["DATE FILLED"]?.trim();

    // Extract base ticker from PAIR: "ADA_CZK" → "ADA"
    const ticker = pair.split("_")[0] ?? "";
    if (!ticker) {
      rows.push({ rowIndex: i, date: "", ticker: "", quantity: 0, type: "BUY", source: "COINMATE_ORDERS", parseError: `Nelze určit ticker z PAIR: ${pair}` });
      return;
    }

    const date = parseDate(dateFilled);
    if (!date) {
      rows.push({ rowIndex: i, date: "", ticker, quantity: 0, type, source: "COINMATE_ORDERS", sourceId: orderId, parseError: `Neparsovatelné datum: ${dateFilled}` });
      return;
    }

    const quantity     = Math.abs(parseAmount(row["ORIG. SIZE"]));
    const pricePerUnit = parseAmount(row["PRICE"]);
    const totalCZK     = parseAmount(row["ORDER TOTAL"]);

    rows.push({
      rowIndex: i,
      date,
      type: type === "SELL" ? "SELL" : "BUY",
      ticker,
      quantity: type === "SELL" ? -quantity : quantity,
      pricePerUnit: pricePerUnit || undefined,
      totalCZK: totalCZK || undefined,
      source: "COINMATE_ORDERS",
      sourceId: orderId || undefined,
    });
  });

  return rows;
}
