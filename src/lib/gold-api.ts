import { fetchECBRate } from "@/lib/csv-parsers/ecb-rates";
import { prisma } from "@/lib/prisma";

export type MetalSymbol = "XAU" | "XAG";

export type MetalPriceResult = {
  priceUsd: number;  // USD per troy ounce
  priceCzk: number;  // converted via ECB USD/CZK rate
  timestamp: Date;
};

export async function fetchMetalPrice(symbol: MetalSymbol): Promise<MetalPriceResult> {
  const apiKey = process.env.GOLD_API_KEY;
  if (!apiKey) throw new Error("GOLD_API_KEY is not set");

  const res = await fetch(`https://www.goldapi.io/api/${symbol}/USD`, {
    headers: { "x-access-token": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GoldAPI HTTP ${res.status} for ${symbol}${text ? `: ${text}` : ""}`);
  }

  const data = await res.json();
  const priceUsd: number = data.price;
  if (typeof priceUsd !== "number" || isNaN(priceUsd)) {
    throw new Error(`GoldAPI returned invalid price for ${symbol}: ${JSON.stringify(data)}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  let usdCzkRate = await fetchECBRate("USD", today);

  if (!usdCzkRate) {
    // ECB may not have today's rate yet (weekend/holiday/delay) — use last cached rate
    const cached = await prisma.exchangeRate.findFirst({
      where: { fromCurrency: "USD", toCurrency: "CZK" },
      orderBy: { date: "desc" },
    });
    if (cached) {
      usdCzkRate = cached.rate;
    } else {
      throw new Error("Could not fetch USD/CZK rate from ECB and no cached rate available");
    }
  }

  return {
    priceUsd,
    priceCzk: priceUsd * usdCzkRate,
    timestamp: new Date(data.timestamp * 1000),
  };
}
