import { readFileSync } from "fs";
import { createHash } from "crypto";
import { PDFParse, VerbosityLevel } from "pdf-parse";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedBankTransaction {
  date: Date;
  description: string;
  amount: number;           // absolute value in CZK, always > 0
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  type: "INCOME" | "EXPENSE";
  source: "AIRBANK_PDF" | "REVOLUT_PDF";
  sourceId: string;
}

export type PDFSource = "AIRBANK" | "REVOLUT" | "UNKNOWN";

// ─── Source detection ─────────────────────────────────────────────────────────

export function detectPDFSource(text: string): PDFSource {
  if (
    text.includes("Air Bank") &&
    (text.includes("Výpis z běžného účtu") || text.includes("AIRACZPP"))
  )
    return "AIRBANK";
  if (
    text.includes("Revolut") &&
    (text.includes("Statement") || text.includes("Money out"))
  )
    return "REVOLUT";
  return "UNKNOWN";
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function makeSourceId(source: string, date: string, amount: string, description: string): string {
  return (
    source +
    "_" +
    createHash("sha256")
      .update(`${date}|${amount}|${description}`)
      .digest("hex")
      .slice(0, 32)
  );
}

/** Parse Czech decimal amount: "1 234,56" or "-50 000,00" → number */
export function parseCzechAmount(raw: string): number {
  const cleaned = raw.trim().replace(/\s+/g, "").replace(",", ".");
  return parseFloat(cleaned);
}

/** Parse US/Revolut decimal amount: "1,600.00" → number */
export function parseUsAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

/**
 * Parse Czech date DD.MM.YYYY → Date (UTC midnight)
 * Returns null for invalid input.
 */
export function parseCzechDate(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
}

const REVOLUT_MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/**
 * Parse Revolut date "Jan 4, 2026" → Date (UTC midnight)
 * Returns null for invalid input.
 */
export function parseRevolutDate(raw: string): Date | null {
  const m = raw.trim().match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!m) return null;
  const month = REVOLUT_MONTHS[m[1]];
  if (!month) return null;
  return new Date(`${m[3]}-${month}-${m[2].padStart(2, "0")}T00:00:00Z`);
}

// ─── Category keyword matching ────────────────────────────────────────────────

const CATEGORY_RULES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /nájem|rent/i, name: "Nájem" },
  {
    pattern:
      /albert|kaufland|kaud|billa|lidl|tesco|penny|wolt|mcdonald|sushi|pizza|cantina|café|cafe|restaurant|canteen|jídel|pivovar|thai|bar\s|diner|geco/i,
    name: "Jídlo",
  },
  { pattern: /uber|bolt|doprava|mhd|idos|omv|benzin|shell|metro\b/i, name: "Doprava" },
  {
    pattern: /netflix|spotify|youtube|cinema|cinestar|apple\.com|apple pay|disney|hbo|lego|game|cinestar/i,
    name: "Zábava",
  },
];

/**
 * Return a category name for a transaction description.
 * Returns "Ostatní" if no keyword matches.
 */
export function detectCategory(description: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(description)) return rule.name;
  }
  return "Ostatní";
}

// ─── Air Bank parser ──────────────────────────────────────────────────────────

// Matches the "AMOUNT FEE" pattern at end of line (Czech decimal format)
// e.g. "-1 234,56 0,00"  "3 000,00 0,00"  "78 032,00 0,00"
const AIRBANK_AMOUNT_RE =
  /(-?\d{1,3}(?:\s\d{3})*,\d{2})\s+(\d{1,3}(?:\s\d{3})*,\d{2})\s*$/;

const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;

function isAirBankNoiseLine(line: string, accountHolder: string): boolean {
  if (!line) return true;
  // Account holder name shown on every tx
  if (line === accountHolder) return true;
  // Pure transaction code (6+ digits)
  if (/^\d{6,}$/.test(line)) return true;
  // Line starting with a long number (tx code + account on same line)
  if (/^\d{6,}\s/.test(line)) return true;
  // Card number pattern: digits, then 4+ asterisks, then digits (e.g. 516844******6992)
  if (/\d{4,}\*{4,}\d{4,}/.test(line)) return true;
  // Account number format: "XXXXXXX / 4-digit"
  if (/^\d[\d-]+ \/ \d{4}$/.test(line)) return true;
  // Variable / constant symbol
  if (/^(VS|KS|SS)\d/.test(line)) return true;
  return false;
}

function buildAirBankDescription(blockLines: string[], accountHolder: string): string {
  if (blockLines.length === 0) return "";

  // Line 0 is the transaction type
  const type = blockLines[0] ?? "";
  const details: string[] = [];

  for (let k = 1; k < blockLines.length; k++) {
    const line = blockLines[k];

    // Check if this line ends with the amount pattern (possibly preceded by description)
    const amountMatch = AIRBANK_AMOUNT_RE.exec(line);
    if (amountMatch) {
      const before = line.slice(0, amountMatch.index).trim();
      if (before && !isAirBankNoiseLine(before, accountHolder)) {
        details.push(before);
      }
      break; // Amount line terminates the description scan
    }

    if (!isAirBankNoiseLine(line, accountHolder)) {
      details.push(line);
    }
  }

  if (details.length === 0) return type;
  return `${type} – ${details[0]}`;
}

export function parseAirBankPDF(text: string): ParsedBankTransaction[] {
  const allLines = text.split("\n").map((l) => l.trim());

  // Extract account holder name (first non-empty line of the PDF)
  const accountHolder = allLines.find((l) => l.length > 0) ?? "";

  const results: ParsedBankTransaction[] = [];

  // Find transaction blocks: each starts with two consecutive DD.MM.YYYY lines
  let i = 0;
  while (i < allLines.length) {
    if (!DATE_RE.test(allLines[i])) { i++; continue; }
    if (i + 1 >= allLines.length || !DATE_RE.test(allLines[i + 1])) { i++; continue; }

    const bookingDateRaw = allLines[i];
    // allLines[i+1] is value date (ignored)

    // Collect block lines until next DATE+DATE pair
    let j = i + 2;
    while (j < allLines.length) {
      if (
        DATE_RE.test(allLines[j]) &&
        j + 1 < allLines.length &&
        DATE_RE.test(allLines[j + 1])
      )
        break;
      j++;
    }

    const blockLines = allLines.slice(i + 2, j);

    // Find the last line that contains AMOUNT_FEE pattern (scan backwards)
    let amountRaw: string | null = null;
    for (let k = blockLines.length - 1; k >= 0; k--) {
      const m = AIRBANK_AMOUNT_RE.exec(blockLines[k]);
      if (m) {
        amountRaw = m[1];
        // Trim block to only include lines up to and including this amount line
        blockLines.splice(k + 1);
        break;
      }
    }

    if (amountRaw === null) { i = j; continue; }

    const amountNum = parseCzechAmount(amountRaw);
    const date = parseCzechDate(bookingDateRaw);
    if (!date) { i = j; continue; }

    const description = buildAirBankDescription(blockLines, accountHolder);
    const sourceId = makeSourceId("AIRBANK_PDF", bookingDateRaw, amountRaw, description);

    results.push({
      date,
      description,
      amount: Math.abs(amountNum),
      type: amountNum >= 0 ? "INCOME" : "EXPENSE",
      source: "AIRBANK_PDF",
      sourceId,
    });

    i = j;
  }

  if (results.length === 0) {
    console.warn("WARNING: 0 transactions parsed from Air Bank PDF. Raw text logged above for inspection.");
    console.log(text.slice(0, 3000));
  }

  return results;
}

// ─── Revolut parser ───────────────────────────────────────────────────────────

// Matches: "Jan 4, 2026  Description  1,600.00 CZK  1,700.00 CZK"
// Groups: (date) (description) (first_amount) (balance)
const REVOLUT_TX_RE =
  /^([A-Z][a-z]{2} \d{1,2}, \d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s+CZK\s+([\d,]+\.?\d*)\s+CZK\s*$/;

export function parseRevolutPDF(text: string): ParsedBankTransaction[] {
  const lines = text.split("\n").map((l) => l.trim());
  const results: ParsedBankTransaction[] = [];

  // Extract opening balance from "Account (Current Account) OPENING CZK ..."
  let prevBalance = 0;
  const balanceSummaryMatch = text.match(
    /Account \(Current Account\)\s+([\d,]+\.?\d*)\s+CZK/
  );
  if (balanceSummaryMatch) {
    prevBalance = parseUsAmount(balanceSummaryMatch[1]);
  }

  // Only process lines in the completed transactions section
  let inCompletedSection = false;

  for (const line of lines) {
    if (line.includes("Account transactions from")) {
      inCompletedSection = true;
      continue;
    }
    if (!inCompletedSection) continue;

    const m = REVOLUT_TX_RE.exec(line);
    if (!m) continue;

    const dateStr = m[1];
    const description = m[2].trim();
    const newBalance = parseUsAmount(m[4]);

    const balanceDiff = newBalance - prevBalance;
    const absAmount = Math.abs(balanceDiff);

    // Skip zero-change lines (unlikely but safe)
    if (absAmount < 0.005) {
      prevBalance = newBalance;
      continue;
    }

    const type: "INCOME" | "EXPENSE" = balanceDiff > 0 ? "INCOME" : "EXPENSE";
    const date = parseRevolutDate(dateStr);
    if (!date) {
      prevBalance = newBalance;
      continue;
    }

    const sourceId = makeSourceId("REVOLUT_PDF", dateStr, String(absAmount.toFixed(2)), description);

    results.push({
      date,
      description,
      amount: absAmount,
      type,
      source: "REVOLUT_PDF",
      sourceId,
    });

    prevBalance = newBalance;
  }

  if (results.length === 0) {
    console.warn("WARNING: 0 transactions parsed from Revolut PDF. Raw text logged above for inspection.");
    console.log(text.slice(0, 3000));
  }

  return results;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function parseBankPDF(
  filePath: string,
  password?: string
): Promise<ParsedBankTransaction[]> {
  const buf = readFileSync(filePath);
  const uint8 = new Uint8Array(buf);
  const parser = new PDFParse({
    data: uint8,
    password: password || undefined,
    verbosity: VerbosityLevel.ERRORS,
  });
  const result = await parser.getText();
  const text = result.text;

  const source = detectPDFSource(text);

  if (source === "AIRBANK") return parseAirBankPDF(text);
  if (source === "REVOLUT") return parseRevolutPDF(text);

  console.warn(
    `WARNING: 0 transactions parsed from ${filePath}. Raw text logged above for inspection.`
  );
  console.log(text.slice(0, 3000));
  return [];
}
