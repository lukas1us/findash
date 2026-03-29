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

  // Separate assets with known CoinGecko IDs from unknown ones
  const knownAssets = cryptoAssets.filter(
    (a) => COINGECKO_IDS[a.ticker.toUpperCase()]
  );
  const unknownAssets = cryptoAssets.filter(
    (a) => !COINGECKO_IDS[a.ticker.toUpperCase()]
  );

  for (const asset of unknownAssets) {
    results.push({ ticker: asset.ticker, price: null, error: "CoinGecko ID not found" });
  }

  if (knownAssets.length === 0) {
    return NextResponse.json({ results });
  }

  // Single batch request for all known tickers
  const geckoIds = knownAssets.map((a) => COINGECKO_IDS[a.ticker.toUpperCase()]).join(",");

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds}&vs_currencies=czk`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`CoinGecko HTTP ${res.status}${errorText ? `: ${errorText}` : ""}`);
    }
    const data = await res.json();

    for (const asset of knownAssets) {
      const geckoId = COINGECKO_IDS[asset.ticker.toUpperCase()];
      const price: number | undefined = data[geckoId]?.czk;
      if (price == null) {
        results.push({ ticker: asset.ticker, price: null, error: "No price in response" });
        continue;
      }
      await prisma.assetPrice.create({
        data: { assetId: asset.id, price, source: "API" },
      });
      results.push({ ticker: asset.ticker, price });
    }
  } catch (err) {
    for (const asset of knownAssets) {
      results.push({ ticker: asset.ticker, price: null, error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
