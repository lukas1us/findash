import Papa from "papaparse";
import type { CryptoTxRow, CryptoTxType } from "./crypto-types";
import { parseAmount } from "./amount-parser";
import { parseDate } from "./date-parser";

interface CoinmateHistoryRow {
  ID: string;
  Datum: string;
  "Účet": string;
  Typ: string;
  "Částka": string;
  "Částka měny": string;
  Cena: string;
  "Cena měny": string;
  Poplatek: string;
  "Poplatek měny": string;
  Celkem: string;
  "Celkem měny": string;
  Popisek: string;
  Status: string;
  [key: string]: string;
}

const VALID_STATUSES = new Set(["OK", "COMPLETED"]);
const VALID_TYPES = new Set(["BUY", "SELL", "DEPOSIT", "WITHDRAWAL"]);

export function parseCoinmateHistory(csvText: string): CryptoTxRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  const result = Papa.parse<CoinmateHistoryRow>(text, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const rows: CryptoTxRow[] = [];

  result.data.forEach((row, i) => {
    const status = (row["Status"] ?? "").toUpperCase();
    if (!VALID_STATUSES.has(status)) return;

    const typeStr = (row["Typ"] ?? "").toUpperCase();
    if (!VALID_TYPES.has(typeStr)) return;

    const date = parseDate(row["Datum"]);
    if (!date) return;

    const ticker = (row["Částka měny"] ?? "").toUpperCase();
    const quantity = Math.abs(parseAmount(row["Částka"]));
    const pricePerUnit = parseAmount(row["Cena"] || "0");
    const fee = Math.abs(parseAmount(row["Poplatek"] || "0"));
    const feeCurrency = (row["Poplatek měny"] ?? "").toUpperCase();

    const celkemMena = (row["Celkem měny"] ?? "").toUpperCase();
    const totalCZK = celkemMena === "CZK"
      ? Math.abs(parseAmount(row["Celkem"] || "0"))
      : 0;

    rows.push({
      rowIndex: i,
      date,
      type: typeStr as CryptoTxType,
      ticker,
      quantity,
      pricePerUnit,
      totalCZK,
      fee,
      feeCurrency,
      source: "COINMATE_HISTORY",
      sourceId: row["ID"] || undefined,
      notes: row["Popisek"] || undefined,
    });
  });

  return rows;
}
