export type MetalSymbol = "XAU" | "XAG";

export type MetalPriceResult = {
  priceUsd: number;  // USD per troy ounce
  priceCzk: number;  // converted via Frankfurter USD/CZK rate
  timestamp: Date;
};

async function fetchUsdCzkRate(): Promise<number> {
  const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=CZK", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Frankfurter API HTTP ${res.status}`);
  const data = await res.json();
  const rate: number | undefined = data?.rates?.CZK;
  if (typeof rate !== "number" || isNaN(rate)) {
    throw new Error(`Frankfurter returned invalid USD/CZK rate: ${JSON.stringify(data)}`);
  }
  return rate;
}

export async function fetchMetalPrice(symbol: MetalSymbol): Promise<MetalPriceResult> {
  const apiKey = process.env.GOLD_API_KEY;
  if (!apiKey) throw new Error("GOLD_API_KEY is not set");

  const [metalRes, usdCzkRate] = await Promise.all([
    fetch(`https://www.goldapi.io/api/${symbol}/USD`, {
      headers: { "x-access-token": apiKey },
      cache: "no-store",
    }),
    fetchUsdCzkRate(),
  ]);

  if (!metalRes.ok) {
    const text = await metalRes.text().catch(() => "");
    throw new Error(`GoldAPI HTTP ${metalRes.status} for ${symbol}${text ? `: ${text}` : ""}`);
  }

  const data = await metalRes.json();
  const priceUsd: number = data.price;
  if (typeof priceUsd !== "number" || isNaN(priceUsd)) {
    throw new Error(`GoldAPI returned invalid price for ${symbol}: ${JSON.stringify(data)}`);
  }

  return {
    priceUsd,
    priceCzk: priceUsd * usdCzkRate,
    timestamp: new Date(data.timestamp * 1000),
  };
}
