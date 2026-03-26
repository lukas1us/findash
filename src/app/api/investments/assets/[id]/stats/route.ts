export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: {
      prices:             { orderBy: { fetchedAt: "desc" }, take: 1 },
      cryptoTransactions: true,
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Aktivum nenalezeno" }, { status: 404 });
  }

  const txs = asset.cryptoTransactions;

  // ── Quantity ──────────────────────────────────────────────────────────────
  const totalQuantity = txs.reduce((sum, t) => sum + t.quantity, 0);

  // ── Average buy price (weighted, BUY only) ────────────────────────────────
  const buyTxs       = txs.filter((t) => t.type === "BUY" && t.pricePerUnit);
  const totalBuyQty  = buyTxs.reduce((s, t) => s + Math.abs(t.quantity), 0);
  const totalBuyCost = buyTxs.reduce((s, t) => s + Math.abs(t.quantity) * t.pricePerUnit!, 0);
  const avgBuyPrice  = totalBuyQty > 0 ? totalBuyCost / totalBuyQty : 0;

  // ── Total invested CZK (BUY + fees) ──────────────────────────────────────
  const totalInvestedCZK = txs
    .filter((t) => t.type === "BUY")
    .reduce((s, t) => s + (t.totalCZK ?? Math.abs(t.quantity) * (t.pricePerUnit ?? 0)) + (t.fee ?? 0), 0);

  // ── Current value ─────────────────────────────────────────────────────────
  const currentPrice = asset.prices[0]?.price ?? 0;
  const currentValue = totalQuantity * currentPrice;

  // ── Unrealized P&L ────────────────────────────────────────────────────────
  // Cost basis of currently held quantity
  const costBasis       = totalQuantity * avgBuyPrice;
  const unrealizedPnL   = currentValue - costBasis;
  const unrealizedPnLPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

  // ── Realized P&L (from SELL transactions) ────────────────────────────────
  const sellTxs = txs.filter((t) => t.type === "SELL" && t.pricePerUnit);
  const realizedPnL = sellTxs.reduce((s, t) => {
    const proceeds = Math.abs(t.quantity) * t.pricePerUnit!;
    const cost     = Math.abs(t.quantity) * avgBuyPrice;
    return s + (proceeds - cost);
  }, 0);

  return NextResponse.json({
    assetId:         asset.id,
    name:            asset.name,
    ticker:          asset.ticker,
    currentPrice,
    totalQuantity,
    avgBuyPrice,
    totalInvestedCZK,
    currentValue,
    unrealizedPnL,
    unrealizedPnLPct,
    realizedPnL,
    txCount:         txs.length,
    lastPriceUpdate: asset.prices[0]?.fetchedAt ?? null,
  });
}
