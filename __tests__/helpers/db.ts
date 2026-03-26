// Shared Prisma client for test setup/teardown.
// DATABASE_URL is overridden to DATABASE_URL_TEST before this module loads
// (see jest.setup.env.ts).
import { prisma } from "@/lib/prisma";

export { prisma as testDb };

/** Remove all rows in dependency order to allow re-seeding. */
export async function clearAll() {
  await prisma.cryptoTransaction.deleteMany();
  await prisma.assetPrice.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
}

/** Clear only finance-related tables. */
export async function clearFinance() {
  await prisma.transaction.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
}

/** Clear only investment-related tables. */
export async function clearInvestments() {
  await prisma.cryptoTransaction.deleteMany();
  await prisma.assetPrice.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.asset.deleteMany();
}
