export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const assets = await prisma.asset.findMany({
    include: {
      purchases: true,
      prices: { orderBy: { fetchedAt: "desc" }, take: 1 },
      cryptoTransactions: { select: { quantity: true, pricePerUnit: true, totalCZK: true, type: true } },
    },
  });

  let totalValue = 0;
  let totalCostBasis = 0;

  const allocationByType: Record<string, number> = {};

  const assetStats = assets.map((asset) => {
    // Purchases — when an asset also has CryptoTransactions (CSV import), exclude
    // CSV-mirrored purchases (externalId set) to avoid double-counting.
    const hasCryptoTxs = asset.cryptoTransactions.length > 0;
    const effectivePurchases = hasCryptoTxs
      ? asset.purchases.filter((p) => !p.externalId) // manual only
      : asset.purchases;

    const purchaseQty  = effectivePurchases.reduce((s, p) => s + (p.type === "SELL" ? -p.quantity : p.quantity), 0);
    const purchaseCost = effectivePurchases.reduce((s, p) => {
      if (p.type === "SELL") return s; // realized; don't include in cost basis
      return s + p.quantity * p.pricePerUnit + p.fees;
    }, 0);

    // CSV-imported crypto transactions — quantity is signed (+receive / −spend)
    const ctQty = asset.cryptoTransactions.reduce((s, ct) => s + ct.quantity, 0);
    const ctCost = asset.cryptoTransactions
      .filter((ct) => ct.type === "BUY" || ct.type === "SWAP")
      .reduce((s, ct) => {
        const cost = ct.totalCZK ?? (Math.abs(ct.quantity) * (ct.pricePerUnit ?? 0));
        return s + (ct.quantity > 0 ? cost : 0); // only count incoming legs
      }, 0);

    const totalQty  = purchaseQty + ctQty;
    const totalCost = purchaseCost + ctCost;
    const avgBuyPrice = totalQty > 0 ? totalCost / totalQty : 0;
    const currentPrice = asset.prices[0]?.price ?? 0;
    const currentValue = totalQty * currentPrice;
    const pnlCzk = currentValue - totalCost;
    const pnlPct = totalCost > 0 ? (pnlCzk / totalCost) * 100 : 0;

    totalValue += currentValue;
    totalCostBasis += totalCost;

    allocationByType[asset.type] = (allocationByType[asset.type] ?? 0) + currentValue;

    return {
      id: asset.id,
      name: asset.name,
      ticker: asset.ticker,
      type: asset.type,
      totalQty,
      avgBuyPrice,
      currentPrice,
      currentValue,
      totalCost,
      pnlCzk,
      pnlPct,
      lastPriceUpdate: asset.prices[0]?.fetchedAt ?? null,
    };
  });

  const typeColors: Record<string, string> = {
    CRYPTO: "#f59e0b",
    REAL_ESTATE: "#3b82f6",
    GOLD_SILVER: "#eab308",
    OTHER: "#6b7280",
  };
  const typeLabels: Record<string, string> = {
    CRYPTO: "Krypto",
    REAL_ESTATE: "Nemovitosti",
    GOLD_SILVER: "Zlato & Stříbro",
    OTHER: "Ostatní",
  };

  const allocationPie = Object.entries(allocationByType).map(([type, value]) => ({
    name: typeLabels[type] ?? type,
    value,
    color: typeColors[type] ?? "#6b7280",
  }));

  return NextResponse.json({
    totalValue,
    totalCostBasis,
    totalPnlCzk: totalValue - totalCostBasis,
    totalPnlPct: totalCostBasis > 0 ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 : 0,
    allocationPie,
    assets: assetStats,
  });
}
