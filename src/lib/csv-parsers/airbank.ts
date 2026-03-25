import Papa from "papaparse";
import type { FinancePreviewRow } from "./types";
import { parseAmount } from "./amount-parser";
import { parseDate } from "./date-parser";

interface AirBankRow {
  "Datum provedení": string;
  "Částka v měně účtu": string;
  "Název protistrany": string;
  "Poznámka": string;
  "ID transakce": string;
  [key: string]: string;
}

export function parseAirBank(csvText: string): FinancePreviewRow[] {
  const text = csvText.replace(/^\uFEFF/, "");

  const result = Papa.parse<AirBankRow>(text, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const rows: FinancePreviewRow[] = [];

  result.data.forEach((row, i) => {
    const rawAmount = row["Částka v měně účtu"];
    const rawDate   = row["Datum provedení"];
    const extId     = row["ID transakce"];

    if (!rawAmount || !rawDate) {
      rows.push({ rowIndex: i, date: "", amount: 0, type: "EXPENSE", description: "", parseError: "Chybí povinný sloupec" });
      return;
    }

    const amount = parseAmount(rawAmount);
    const date   = parseDate(rawDate);

    if (!date) {
      rows.push({ rowIndex: i, date: "", amount: 0, type: "EXPENSE", description: "", externalId: extId, parseError: `Neparsovatelné datum: ${rawDate}` });
      return;
    }

    const namePart = row["Název protistrany"]?.trim() ?? "";
    const notePart = row["Poznámka"]?.trim() ?? "";
    const description = [namePart, notePart].filter(Boolean).join(" — ");

    rows.push({
      rowIndex: i,
      date,
      amount: Math.abs(amount),
      type: amount < 0 ? "EXPENSE" : "INCOME",
      description: description || "Air Bank transakce",
      externalId: extId || undefined,
    });
  });

  return rows;
}
