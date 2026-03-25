export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const assets = await prisma.asset.findMany({
    include: {
      purchases: true,
      prices: { orderBy: { fetchedAt: "desc" }, take: 1 },
    },
  });

  let totalValue = 0;
  let totalCostBasis = 0;

  const allocationByType: Record<string, number> = {};

  const assetStats = assets.map((asset) => {
    const totalQty = asset.purchases.reduce((s, p) => s + p.quantity, 0);
    const totalCost = asset.purchases.reduce((s, p) => s + p.quantity * p.pricePerUnit + p.fees, 0);
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
