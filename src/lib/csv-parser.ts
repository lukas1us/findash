import Papa from "papaparse";
import { parseAirBank } from "./csv-parsers/airbank";
import { parseRevolut } from "./csv-parsers/revolut";
import { parseDate } from "./csv-parsers/date-parser";
import { parseAmount } from "./csv-parsers/amount-parser";

export type BankFormat = "airbank" | "revolut" | "generic";

export type ParsedTransaction = {
  date: Date;
  amount: number; // positive = income, negative = expense
  description: string;
  rawRow: string; // unique string per transaction — hashed to produce importId in the API
};

export function parseBankCsv(content: string, bank: BankFormat): ParsedTransaction[] {
  switch (bank) {
    case "airbank":
      return parseAirBankAdapter(content);
    case "revolut":
      return parseRevolutAdapter(content);
    case "generic":
      return parseGeneric(content);
  }
}

// ─── Air Bank adapter ─────────────────────────────────────────────────────────
// Delegates to the existing parseAirBank parser and converts FinancePreviewRow
// to ParsedTransaction. Uses externalId (Air Bank's own transaction ID) as the
// rawRow so importId deduplication is stable across re-imports of the same file.

function parseAirBankAdapter(content: string): ParsedTransaction[] {
  const rows = parseAirBank(content);
  return rows.flatMap((row) => {
    if (row.parseError || !row.date) return [];
    const rawRow = row.externalId ?? `${row.date}|${row.amount}|${row.description}`;
    return [{
      date: new Date(row.date + "T12:00:00Z"),
      amount: row.type === "INCOME" ? row.amount : -row.amount,
      description: row.description,
      rawRow,
    }];
  });
}

// ─── Revolut adapter ──────────────────────────────────────────────────────────
// Delegates to the existing parseRevolut parser. Revolut rows already carry an
// externalId built from Started Date|Amount|Description, which is used as rawRow.
// PENDING transactions are automatically filtered out by parseRevolut.

function parseRevolutAdapter(content: string): ParsedTransaction[] {
  const rows = parseRevolut(content);
  return rows.flatMap((row) => {
    if (row.parseError || !row.date) return [];
    const rawRow = row.externalId ?? `${row.date}|${row.amount}|${row.description}`;
    return [{
      date: new Date(row.date + "T12:00:00Z"),
      amount: row.type === "INCOME" ? row.amount : -row.amount,
      description: row.description,
      rawRow,
    }];
  });
}

// ─── Generic ──────────────────────────────────────────────────────────────────
// Auto-detect delimiter (comma or semicolon) and column names.

const DATE_COLUMN_NAMES   = ["datum", "date", "dt"];
const AMOUNT_COLUMN_NAMES = ["objem", "castka", "částka", "amount", "sum", "value", "zaúčtovaná částka", "zauctovana castka"];
const DESC_COLUMN_NAMES   = ["popis", "description", "zprava", "zpráva", "nazev", "název", "note", "notes"];

function findCol(headers: string[], candidates: string[]): string | undefined {
  const lower = headers.map((h) => h.toLowerCase());
  return headers[lower.findIndex((h) => candidates.some((c) => h.includes(c)))];
}

function parseGeneric(content: string): ParsedTransaction[] {
  const text = content.replace(/^\uFEFF/, "");
  const delimiter = text.includes(";") ? ";" : ",";

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().replace(/^"|"$/g, ""),
    transform: (v) => v.trim().replace(/^"|"$/g, ""),
  });

  if (result.data.length === 0) return [];
  const headers = Object.keys(result.data[0]);

  const dateCol   = findCol(headers, DATE_COLUMN_NAMES);
  const amountCol = findCol(headers, AMOUNT_COLUMN_NAMES);
  const descCol   = findCol(headers, DESC_COLUMN_NAMES);

  if (!dateCol || !amountCol) return [];

  return result.data.flatMap((row) => {
    const rawDate = row[dateCol] ?? "";
    const rawAmount = row[amountCol] ?? "";
    if (!rawDate || !rawAmount) return [];

    const dateStr = parseDate(rawDate);
    if (!dateStr) return [];

    const amount = parseAmount(rawAmount);
    const description = (descCol ? row[descCol] : "") || "Import";
    const rawRow = Object.values(row).join(delimiter);

    return [{
      date: new Date(dateStr + "T12:00:00Z"),
      amount,
      description,
      rawRow,
    }];
  });
}
