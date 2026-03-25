import { startOfMonth, parseISO } from "date-fns";
import { testDb } from "./db";

// ─── Finance factories ────────────────────────────────────────────────────────

export async function createTestAccount(
  overrides: Partial<{ name: string; type: string; currency: string; balance: number }> = {}
) {
  return testDb.account.create({
    data: {
      name: overrides.name ?? "Test Account",
      type: (overrides.type as "CHECKING" | "SAVINGS" | "CASH") ?? "CHECKING",
      currency: overrides.currency ?? "CZK",
      balance: overrides.balance ?? 0,
    },
  });
}

export async function createTestCategory(
  overrides: Partial<{ name: string; type: string; color: string; icon: string }> = {}
) {
  return testDb.category.create({
    data: {
      name: overrides.name ?? "Test Category",
      type: (overrides.type as "INCOME" | "EXPENSE") ?? "EXPENSE",
      color: overrides.color ?? "#6366f1",
      icon: overrides.icon ?? "tag",
    },
  });
}

export async function createTestTransaction(
  accountId: string,
  categoryId: string,
  overrides: Partial<{
    amount: number;
    type: string;
    description: string;
    date: Date;
  }> = {}
) {
  const amount = overrides.amount ?? 100;
  const type = (overrides.type as "INCOME" | "EXPENSE") ?? "EXPENSE";
  const date = overrides.date ?? new Date();

  const transaction = await testDb.transaction.create({
    data: {
      accountId,
      categoryId,
      amount,
      type,
      description: overrides.description ?? "Test transaction",
      date,
    },
  });

  // Update account balance to match
  const delta = type === "INCOME" ? amount : -amount;
  await testDb.account.update({
    where: { id: accountId },
    data: { balance: { increment: delta } },
  });

  return transaction;
}

export async function createTestBudget(
  categoryId: string,
  overrides: Partial<{ amount: number; month: string }> = {}
) {
  const monthStr = overrides.month ?? "2024-01";
  // Use the same date derivation as the POST route so the filter in GET matches.
  const month = startOfMonth(parseISO(`${monthStr}-01`));
  return testDb.budget.create({
    data: {
      categoryId,
      amount: overrides.amount ?? 5000,
      month,
    },
    include: { category: true },
  });
}

// ─── Investment factories ────────────────────────────────────────────────────

export async function createTestAsset(
  overrides: Partial<{
    name: string;
    ticker: string;
    type: string;
    currency: string;
  }> = {}
) {
  return testDb.asset.create({
    data: {
      name: overrides.name ?? "Bitcoin",
      ticker: overrides.ticker ?? "BTC",
      type: (overrides.type as "CRYPTO" | "REAL_ESTATE" | "GOLD_SILVER" | "OTHER") ?? "CRYPTO",
      currency: overrides.currency ?? "CZK",
    },
  });
}

export async function createTestPurchase(
  assetId: string,
  overrides: Partial<{
    quantity: number;
    pricePerUnit: number;
    fees: number;
    date: Date;
    notes: string;
  }> = {}
) {
  return testDb.purchase.create({
    data: {
      assetId,
      date: overrides.date ?? new Date("2024-01-01"),
      quantity: overrides.quantity ?? 1,
      pricePerUnit: overrides.pricePerUnit ?? 1000000,
      fees: overrides.fees ?? 0,
      notes: overrides.notes,
    },
    include: { asset: true },
  });
}

export async function createTestPrice(
  assetId: string,
  overrides: Partial<{ price: number; source: string }> = {}
) {
  return testDb.assetPrice.create({
    data: {
      assetId,
      price: overrides.price ?? 1500000,
      source: (overrides.source as "MANUAL" | "API") ?? "MANUAL",
    },
    include: { asset: true },
  });
}
