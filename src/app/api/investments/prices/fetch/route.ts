export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// CoinGecko ID mapping for common tickers
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  ADA: "cardano",
  SOL: "solana",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  XRP: "ripple",
  LTC: "litecoin",
  DOGE: "dogecoin",
};

export async function POST() {
  const cryptoAssets = await prisma.asset.findMany({
    where: { type: "CRYPTO" },
  });

  const results: { ticker: string; price: number | null; error?: string }[] = [];

  for (const asset of cryptoAssets) {
    const geckoId = COINGECKO_IDS[asset.ticker.toUpperCase()];
    if (!geckoId) {
      results.push({ ticker: asset.ticker, price: null, error: "CoinGecko ID not found" });
      continue;
    }

    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=czk`,
        { next: { revalidate: 0 } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const price = data[geckoId]?.czk;
      if (!price) throw new Error("No price in response");

      await prisma.assetPrice.create({
        data: { assetId: asset.id, price, source: "API" },
      });
      results.push({ ticker: asset.ticker, price });
    } catch (err) {
      results.push({ ticker: asset.ticker, price: null, error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
