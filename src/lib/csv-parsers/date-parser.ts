/**
 * Parse date strings from various formats into YYYY-MM-DD.
 *   "DD.MM.YYYY"            Air Bank, Coinmate
 *   "YYYY-MM-DD"            ISO
 *   "YYYY-MM-DD HH:MM:SS"   Revolut, Crypto.com (strip time)
 *   "YYYY-MM-DDTHH:MM:SSZ"  ISO with time
 */
export function parseDate(raw: string | undefined | null): string {
  if (!raw) return "";
  const s = raw.trim();

  // DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // YYYY-MM-DD (optionally followed by time)
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m}-${d}`;
  }

  return "";
}

/** Subtract `days` days from a YYYY-MM-DD string */
export function subtractDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
