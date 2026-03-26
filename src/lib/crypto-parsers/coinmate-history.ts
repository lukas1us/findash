import Papa from "papaparse";
import type { CryptoPreviewRow, CryptoTxType } from "./types";
import { parseAmount } from "../csv-parsers/amount-parser";
import { parseDate } from "../csv-parsers/date-parser";

interface CoinmateHistoryRow {
  ID:                string;
  Datum:             string;
  "Účet":            string;
  Typ:               string;
  "Částka":          string;
  "Částka měny":     string;
  Cena:              string;
  "Cena měny":       string;
  Poplatek:          string;
  "Poplatek měny":   string;
  Celkem:            string;
  "Celkem měny":     string;
  Popisek:           string;
  Status:            string;
  [key: string]: string;
}

const TYPE_MAP: Record<string, CryptoTxType> = {
  BUY:        "BUY",
  SELL:       "SELL",
  WITHDRAWAL: "WITHDRAWAL",
  DEPOSIT:    "DEPOSIT",
};

export function parseCoinmateHistory(csvText: string): CryptoPreviewRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  const result = Papa.parse<CoinmateHistoryRow>(text, {
    header:      true,
    delimiter:   ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform:   (v) => v.trim(),
  });

  const rows: CryptoPreviewRow[] = [];

  result.data.forEach((row, i) => {
    const status = (row["Status"] ?? "").toUpperCase();
    if (status !== "COMPLETED" && status !== "OK") return;

    const id     = row["ID"]?.trim();
    const typ    = (row["Typ"] ?? "").toUpperCase();
    const txType = TYPE_MAP[typ];

    if (!txType) return; // skip unmapped types

    const rawDate  = row["Datum"]?.trim();
    const date     = parseDate(rawDate);
    if (!date) {
      rows.push({ rowIndex: i, date: "", ticker: "", quantity: 0, type: txType, source: "COINMATE_HISTORY", sourceId: id, parseError: `Neparsovatelné datum: ${rawDate}` });
      return;
    }

    const ticker   = (row["Částka měny"] ?? "").toUpperCase().trim();
    if (!ticker) {
      rows.push({ rowIndex: i, date, ticker: "", quantity: 0, type: txType, source: "COINMATE_HISTORY", sourceId: id, parseError: "Chybí Částka měny" });
      return;
    }

    const qty          = parseAmount(row["Částka"]);
    const pricePerUnit = parseAmount(row["Cena"]) || undefined;
    const feeCurrency  = (row["Poplatek měny"] ?? "").toUpperCase().trim() || undefined;
    const fee          = parseAmount(row["Poplatek"]) || undefined;
    const totalCZK     = (row["Celkem měny"] ?? "").toUpperCase() === "CZK"
      ? (parseAmount(row["Celkem"]) || undefined)
      : undefined;

    const isSend = txType === "SELL" || txType === "WITHDRAWAL";
    const quantity = isSend ? -Math.abs(qty) : Math.abs(qty);

    rows.push({
      rowIndex: i,
      date,
      type: txType,
      ticker,
      quantity,
      pricePerUnit,
      totalCZK,
      fee,
      feeCurrency,
      source: "COINMATE_HISTORY",
      sourceId: id || undefined,
      notes: row["Popisek"] || undefined,
    });
  });

  return rows;
}
