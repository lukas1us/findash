import type { CsvFormat } from "./types";

const SIGNATURES: Record<CsvFormat, string[]> = {
  airbank:   ["ID transakce", "Datum provedení", "Částka v měně účtu"],
  revolut:   ["Started Date", "Completed Date", "State", "Transaction Kind" /* absent */],
  coinmate:  ["Měna ceny", "Měna poplatku", "ID"],
  cryptocom: ["Transaction Kind", "Native Currency", "Timestamp (UTC)"],
};

// revolut and cryptocom are both comma-delimited; differentiate by unique columns
const REVOLUT_MUST   = ["Started Date", "State"];
const CRYPTOCOM_MUST = ["Transaction Kind", "Native Currency"];
const AIRBANK_MUST   = ["ID transakce", "Datum provedení"];
const COINMATE_MUST  = ["Měna ceny", "Typ"];

export function detectFormat(csvText: string): CsvFormat | "unknown" {
  // Strip BOM
  const text = csvText.replace(/^\uFEFF/, "");
  // Use only the first line for detection
  const header = text.split(/\r?\n/)[0] ?? "";

  if (AIRBANK_MUST.every((col) => header.includes(col)))   return "airbank";
  if (REVOLUT_MUST.every((col) => header.includes(col)))   return "revolut";
  if (COINMATE_MUST.every((col) => header.includes(col)))  return "coinmate";
  if (CRYPTOCOM_MUST.every((col) => header.includes(col))) return "cryptocom";

  return "unknown";
}
