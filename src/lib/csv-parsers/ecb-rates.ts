import { prisma } from "@/lib/prisma";
import { subtractDays } from "./date-parser";

/**
 * Fetch 1 {currency} → CZK exchange rate for a given date (YYYY-MM-DD).
 * - Checks DB cache first
 * - Falls back up to 3 previous days (weekends/holidays)
 * - Returns null if unavailable
 */
export async function fetchECBRate(
  currency: string,
  date: string
): Promise<number | null> {
  if (currency === "CZK") return 1;

  // Try date, then up to 3 days back
  for (let i = 0; i <= 3; i++) {
    const tryDate = i === 0 ? date : subtractDays(date, i);
    const rate = await getRateForDate(currency, tryDate);
    if (rate !== null) return rate;
  }
  return null;
}

async function getRateForDate(currency: string, date: string): Promise<number | null> {
  // Cache hit
  const cached = await prisma.exchangeRate.findUnique({
    where: { fromCurrency_toCurrency_date: { fromCurrency: currency, toCurrency: "CZK", date } },
  });
  if (cached) return cached.rate;

  // Fetch from ECB
  try {
    const url =
      `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.CZK.SP00.A` +
      `?startPeriod=${date}&endPeriod=${date}&format=jsondata`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const json = await res.json();
    const series = json?.dataSets?.[0]?.series?.["0:0:0:0:0"];
    if (!series) return null;

    const observations: Record<string, number[]> = series.observations ?? {};
    const firstKey = Object.keys(observations)[0];
    if (!firstKey) return null;

    const rate = observations[firstKey]?.[0];
    if (typeof rate !== "number" || isNaN(rate)) return null;

    // Store in cache
    await prisma.exchangeRate.upsert({
      where: { fromCurrency_toCurrency_date: { fromCurrency: currency, toCurrency: "CZK", date } },
      update: { rate, fetchedAt: new Date() },
      create: { fromCurrency: currency, toCurrency: "CZK", rate, date, source: "ECB" },
    });

    return rate;
  } catch {
    return null;
  }
}
