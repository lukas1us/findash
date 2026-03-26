import { prisma } from "@/lib/prisma";
import type { NetWorthSnapshot } from "@/generated/prisma/client";

export type NetWorthData = {
  cashTotal: number;
  investmentsTotal: number;
  total: number;
};

/**
 * Calculates current net worth without saving to the database.
 * - cashTotal: sum of balance across all accounts
 * - investmentsTotal: sum of (latestPrice × totalQuantity) per asset
 *   Assets with no price record contribute 0.
 */
export async function calculateCurrentNetWorth(): Promise<NetWorthData> {
  const [accounts, assets] = await Promise.all([
    prisma.account.findMany({ select: { balance: true } }),
    prisma.asset.findMany({
      include: {
        purchases: { select: { quantity: true } },
        prices: { orderBy: { fetchedAt: "desc" }, take: 1, select: { price: true } },
      },
    }),
  ]);

  const cashTotal = accounts.reduce((sum, a) => sum + a.balance, 0);

  const investmentsTotal = assets.reduce((sum, asset) => {
    const totalQty = asset.purchases.reduce((s, p) => s + p.quantity, 0);
    const latestPrice = asset.prices[0]?.price ?? 0;
    return sum + totalQty * latestPrice;
  }, 0);

  return {
    cashTotal,
    investmentsTotal,
    total: cashTotal + investmentsTotal,
  };
}

/**
 * Calculates current net worth and upserts a snapshot for today.
 * Calling this multiple times on the same day overwrites the earlier value.
 */
export async function saveSnapshot(): Promise<NetWorthSnapshot> {
  const data = await calculateCurrentNetWorth();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return prisma.netWorthSnapshot.upsert({
    where: { date: today },
    update: {
      cashTotal: data.cashTotal,
      investmentsTotal: data.investmentsTotal,
      total: data.total,
    },
    create: {
      date: today,
      cashTotal: data.cashTotal,
      investmentsTotal: data.investmentsTotal,
      total: data.total,
    },
  });
}
