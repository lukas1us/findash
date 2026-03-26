import Papa from "papaparse";
import type { CryptoTxRow, CryptoTxType } from "./crypto-types";
import { parseDate } from "./date-parser";

interface CoinmateOrderRow {
  "ORDER ID": string;
  "DATE OPENED": string;
  "TYPE": string;
  "PAIR": string;
  "ORIG. SIZE": string;
  "REMAIN. SIZE": string;
  "PRICE": string;
  "ORDER TOTAL": string;
  "REMAIN. TOTAL": string;
  "STATUS": string;
  "CLIENT ID": string;
  "DATE FILLED": string;
  [key: string]: string;
}

export function parseCoinmateOrders(csvText: string): CryptoTxRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  const result = Papa.parse<CoinmateOrderRow>(text, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const rows: CryptoTxRow[] = [];

  result.data.forEach((row, i) => {
    if ((row["STATUS"] ?? "").toUpperCase() !== "FILLED") return;

    const typeStr = (row["TYPE"] ?? "").toUpperCase();
    if (typeStr !== "BUY" && typeStr !== "SELL") return;

    const pair = row["PAIR"] ?? "";
    const parts = pair.split("_");
    const ticker = (parts[0] ?? "").toUpperCase();
    const quoteCurrency = (parts[1] ?? "CZK").toUpperCase();

    const date = parseDate(row["DATE FILLED"] || row["DATE OPENED"]);
    if (!date) return;

    const quantity = Math.abs(parseFloat(row["ORIG. SIZE"]) || 0);
    const pricePerUnit = parseFloat(row["PRICE"]) || 0;
    const orderTotal = Math.abs(parseFloat(row["ORDER TOTAL"]) || 0);
    const totalCZK = quoteCurrency === "CZK" ? orderTotal : 0;

    rows.push({
      rowIndex: i,
      date,
      type: typeStr as CryptoTxType,
      ticker,
      quantity,
      pricePerUnit,
      totalCZK,
      fee: 0,
      feeCurrency: "",
      source: "COINMATE_ORDERS",
      sourceId: row["ORDER ID"] || undefined,
    });
  });

  return rows;
}
