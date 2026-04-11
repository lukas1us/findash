export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchMetalPrice } from "@/lib/gold-api";

// Maps any common gold/silver ticker variant to the GoldAPI symbol
const TICKER_TO_SYMBOL: Record<string, "XAU" | "XAG"> = {
  XAU: "XAU", GOLD: "XAU", AU: "XAU", GLD: "XAU",
  XAG: "XAG", SILVER: "XAG", AG: "XAG", SLV: "XAG",
};

export async function POST() {
  const goldSilverAssets = await prisma.asset.findMany({
    where: { type: "GOLD_SILVER" },
  });

  const relevantAssets = goldSilverAssets.filter(
    (a) => a.ticker.toUpperCase() in TICKER_TO_SYMBOL
  );

  if (relevantAssets.length === 0) {
    return NextResponse.json({ updated: [], pricesUsd: null, error: "Žádná aktiva ke stažení" });
  }

  const symbols = [...new Set(
    relevantAssets.map((a) => TICKER_TO_SYMBOL[a.ticker.toUpperCase()])
  )];

  let prices: Record<string, { priceUsd: number; priceCzk: number }>;
  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const result = await fetchMetalPrice(symbol);
        return [symbol, result] as const;
      })
    );
    prices = Object.fromEntries(results.map(([sym, r]) => [sym, { priceUsd: r.priceUsd, priceCzk: r.priceCzk }]));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  const updated: string[] = [];
  for (const asset of relevantAssets) {
    const symbol = TICKER_TO_SYMBOL[asset.ticker.toUpperCase()];
    const price = prices[symbol];
    if (!price) continue;

    await prisma.assetPrice.create({
      data: { assetId: asset.id, price: price.priceCzk, source: "API" },
    });
    updated.push(asset.name);
  }

  return NextResponse.json({
    updated,
    pricesUsd: {
      XAU: prices["XAU"]?.priceUsd ?? null,
      XAG: prices["XAG"]?.priceUsd ?? null,
    },
  });
}
