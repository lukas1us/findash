/**
 * Parse amount strings in various formats:
 *   Czech/European: "1 234,56"  "1.234,56"  "-500,00"
 *   US/ISO:         "1,234.56"  "1234.56"   "-500.00"
 *   Coinmate:       "0.00123456"
 */
export function parseAmount(raw: string | undefined | null): number {
  if (!raw) return 0;
  const s = raw.trim().replace(/\s/g, ""); // remove all whitespace (thousands sep)
  if (!s) return 0;

  // Determine decimal separator
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  let normalized: string;

  if (lastComma > lastDot) {
    // Comma is decimal separator (European): "1.234,56" → "1234.56"
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // Dot is decimal separator (US/ISO): "1,234.56" → "1234.56"
    normalized = s.replace(/,/g, "");
  } else {
    // No separator or only one: treat as-is
    normalized = s;
  }

  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}
