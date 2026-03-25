import Papa from "papaparse";
import type { InvestmentPreviewRow, InvestmentAction } from "./types";
import { parseAmount } from "./amount-parser";
import { parseDate } from "./date-parser";

interface CoinmateRow {
  ID: string;
  Datum: string;
  "Účet": string;
  Typ: string;
  "Částka": string;
  "Měna": string;
  Cena: string;
  "Měna ceny": string;
  Poplatek: string;
  "Měna poplatku": string;
  Popis: string;
  [key: string]: string;
}

const IMPORT_TYPES = new Set(["BUY", "DEPOSIT"]);

export function parseCoinmate(csvText: string): InvestmentPreviewRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  const result = Papa.parse<CoinmateRow>(text, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const rows: InvestmentPreviewRow[] = [];

  result.data.forEach((row, i) => {
    const typ = (row["Typ"] ?? "").toUpperCase();

    if (!IMPORT_TYPES.has(typ)) return; // skip SELL, WITHDRAWAL, etc.

    const rawQty   = row["Částka"];
    const rawPrice = row["Cena"];
    const rawDate  = row["Datum"];
    const ticker   = row["Měna"]?.toUpperCase() ?? "";
    const extId    = row["ID"];

    if (!rawQty || !rawDate) {
      rows.push({ rowIndex: i, date: "", ticker, quantity: 0, pricePerUnit: 0, fees: 0, action: "BUY", parseError: "Chybí Částka nebo Datum" });
      return;
    }

    const date = parseDate(rawDate);
    if (!date) {
      rows.push({ rowIndex: i, date: "", ticker, quantity: 0, pricePerUnit: 0, fees: 0, action: "BUY", parseError: `Neparsovatelné datum: ${rawDate}` });
      return;
    }

    const quantity     = Math.abs(parseAmount(rawQty));
    const pricePerUnit = parseAmount(rawPrice ?? "0");
    const fee          = Math.abs(parseAmount(row["Poplatek"] ?? "0"));

    // Convert fee to CZK (simplification: assume fee is in same currency as price)
    const feeCzk = fee; // fee in Měna poplatku; if poplatek is in crypto, this may be inaccurate
                        // For now treat as CZK equivalent

    rows.push({
      rowIndex: i,
      date,
      ticker,
      quantity,
      pricePerUnit,
      fees: feeCzk,
      action: typ === "BUY" ? "BUY" : "DEPOSIT",
      description: row["Popis"] || undefined,
      externalId: extId || undefined,
    });
  });

  return rows;
}
