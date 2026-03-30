import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  AccountType,
  TransactionType,
  CategoryType,
  AssetType,
  PriceSource,
} from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up
  await prisma.budget.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.assetPrice.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.asset.deleteMany();

  // ─── Accounts ───────────────────────────────────────────────────────────────
  const checking = await prisma.account.create({
    data: { name: "Běžný účet", type: AccountType.CHECKING, currency: "CZK", balance: 45230 },
  });
  const savings = await prisma.account.create({
    data: { name: "Spořicí účet", type: AccountType.SAVINGS, currency: "CZK", balance: 120000 },
  });
  const cash = await prisma.account.create({
    data: { name: "Hotovost", type: AccountType.CASH, currency: "CZK", balance: 3500 },
  });

  // ─── Categories ─────────────────────────────────────────────────────────────
  const catSalary = await prisma.category.create({
    data: { name: "Plat", type: CategoryType.INCOME, color: "#22c55e", icon: "briefcase" },
  });
  const catFreelance = await prisma.category.create({
    data: { name: "Freelance", type: CategoryType.INCOME, color: "#10b981", icon: "laptop" },
  });
  const catRent = await prisma.category.create({
    data: { name: "Nájem", type: CategoryType.EXPENSE, color: "#ef4444", icon: "home" },
  });
  const catFood = await prisma.category.create({
    data: { name: "Jídlo", type: CategoryType.EXPENSE, color: "#f97316", icon: "utensils" },
  });
  const catTransport = await prisma.category.create({
    data: { name: "Doprava", type: CategoryType.EXPENSE, color: "#3b82f6", icon: "car" },
  });
  const catInvestments = await prisma.category.create({
    data: { name: "Investice", type: CategoryType.EXPENSE, color: "#8b5cf6", icon: "trending-up" },
  });
  const catEntertainment = await prisma.category.create({
    data: { name: "Zábava", type: CategoryType.EXPENSE, color: "#ec4899", icon: "film" },
  });
  const catHealth = await prisma.category.create({
    data: { name: "Zdraví", type: CategoryType.EXPENSE, color: "#06b6d4", icon: "heart" },
  });
  const catUtilities = await prisma.category.create({
    data: { name: "Energie a služby", type: CategoryType.EXPENSE, color: "#f59e0b", icon: "zap" },
  });
  const catShopping = await prisma.category.create({
    data: { name: "Nakupování", type: CategoryType.EXPENSE, color: "#84cc16", icon: "shopping-bag" },
  });

  // ─── Transactions (last 6 months) ───────────────────────────────────────────
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    return d;
  }).reverse();

  for (const monthDate of months) {
    const m = monthDate.getMonth();
    const y = monthDate.getFullYear();

    const d = (day: number) => new Date(y, m, day);

    // Income
    await prisma.transaction.createMany({
      data: [
        { accountId: checking.id, categoryId: catSalary.id, amount: 58000, type: TransactionType.INCOME, description: "Výplata", date: d(1) },
        { accountId: checking.id, categoryId: catFreelance.id, amount: Math.round(5000 + Math.random() * 8000), type: TransactionType.INCOME, description: "Freelance projekt", date: d(15) },
      ],
    });

    // Expenses
    await prisma.transaction.createMany({
      data: [
        { accountId: checking.id, categoryId: catRent.id, amount: 18000, type: TransactionType.EXPENSE, description: "Nájem byt Praha", date: d(2) },
        { accountId: checking.id, categoryId: catFood.id, amount: Math.round(3500 + Math.random() * 1500), type: TransactionType.EXPENSE, description: "Potraviny Albert", date: d(5) },
        { accountId: checking.id, categoryId: catFood.id, amount: Math.round(1200 + Math.random() * 800), type: TransactionType.EXPENSE, description: "Restaurace", date: d(12) },
        { accountId: checking.id, categoryId: catTransport.id, amount: 690, type: TransactionType.EXPENSE, description: "MHD Praha měsíční", date: d(3) },
        { accountId: checking.id, categoryId: catTransport.id, amount: Math.round(400 + Math.random() * 600), type: TransactionType.EXPENSE, description: "Benzín", date: d(18) },
        { accountId: checking.id, categoryId: catUtilities.id, amount: Math.round(2200 + Math.random() * 400), type: TransactionType.EXPENSE, description: "Elektřina a plyn", date: d(10) },
        { accountId: checking.id, categoryId: catInvestments.id, amount: 5000, type: TransactionType.EXPENSE, description: "Nákup ETF", date: d(20) },
        { accountId: checking.id, categoryId: catEntertainment.id, amount: Math.round(500 + Math.random() * 1000), type: TransactionType.EXPENSE, description: "Netflix, Spotify", date: d(8) },
        { accountId: checking.id, categoryId: catHealth.id, amount: Math.round(300 + Math.random() * 700), type: TransactionType.EXPENSE, description: "Lékárna", date: d(22) },
        { accountId: cash.id, categoryId: catFood.id, amount: Math.round(200 + Math.random() * 500), type: TransactionType.EXPENSE, description: "Oběd", date: d(14) },
        { accountId: checking.id, categoryId: catShopping.id, amount: Math.round(800 + Math.random() * 2000), type: TransactionType.EXPENSE, description: "Oblečení / elektronika", date: d(25) },
      ],
    });
  }

  // ─── Budgets (current month) ─────────────────────────────────────────────────
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  await prisma.budget.createMany({
    data: [
      { categoryId: catRent.id, amount: 18000, month: currentMonth },
      { categoryId: catFood.id, amount: 6000, month: currentMonth },
      { categoryId: catTransport.id, amount: 1500, month: currentMonth },
      { categoryId: catUtilities.id, amount: 3000, month: currentMonth },
      { categoryId: catEntertainment.id, amount: 1500, month: currentMonth },
      { categoryId: catHealth.id, amount: 1000, month: currentMonth },
      { categoryId: catShopping.id, amount: 3000, month: currentMonth },
      { categoryId: catInvestments.id, amount: 8000, month: currentMonth },
    ],
  });

  // ─── Investment Assets ────────────────────────────────────────────────────────
  const btc = await prisma.asset.create({
    data: { name: "Bitcoin", ticker: "BTC", type: AssetType.CRYPTO, currency: "CZK" },
  });
  const ada = await prisma.asset.create({
    data: { name: "Cardano", ticker: "ADA", type: AssetType.CRYPTO, currency: "CZK" },
  });
  const gold = await prisma.asset.create({
    data: { name: "Zlato", ticker: "XAU", type: AssetType.GOLD_SILVER, currency: "CZK" },
  });
  const silver = await prisma.asset.create({
    data: { name: "Stříbro", ticker: "XAG", type: AssetType.GOLD_SILVER, currency: "CZK" },
  });
  const reEstate = await prisma.asset.create({
    data: { name: "Byt Praha 3", ticker: "RE-PRG3", type: AssetType.REAL_ESTATE, currency: "CZK" },
  });
  const xlm = await prisma.asset.create({
    data: { name: "Stellar", ticker: "XLM", type: AssetType.CRYPTO, currency: "CZK" },
  });
  const doge = await prisma.asset.create({
    data: { name: "Dogecoin", ticker: "DOGE", type: AssetType.CRYPTO, currency: "CZK" },
  });
  const shib = await prisma.asset.create({
    data: { name: "Shiba Inu", ticker: "SHIB", type: AssetType.CRYPTO, currency: "CZK" },
  });
  const cro = await prisma.asset.create({
    data: { name: "Cronos", ticker: "CRO", type: AssetType.CRYPTO, currency: "CZK" },
  });

  // ─── Purchases ───────────────────────────────────────────────────────────────
  // BTC purchases
  await prisma.purchase.createMany({
    data: [
      { assetId: btc.id, date: new Date("2023-01-15"), quantity: 0.05, pricePerUnit: 420000, fees: 210, notes: "DCA leden 2023" },
      { assetId: btc.id, date: new Date("2023-06-10"), quantity: 0.03, pricePerUnit: 630000, fees: 189, notes: "DCA červen 2023" },
      { assetId: btc.id, date: new Date("2024-01-20"), quantity: 0.02, pricePerUnit: 950000, fees: 190, notes: "DCA leden 2024" },
    ],
  });

  // ADA purchases
  await prisma.purchase.createMany({
    data: [
      { assetId: ada.id, date: new Date("2023-03-01"), quantity: 5000, pricePerUnit: 8.5, fees: 42, notes: "Nákup ADA" },
      { assetId: ada.id, date: new Date("2023-09-15"), quantity: 3000, pricePerUnit: 11.2, fees: 33, notes: "Navýšení pozice" },
    ],
  });

  // Gold
  await prisma.purchase.createMany({
    data: [
      { assetId: gold.id, date: new Date("2022-11-01"), quantity: 5, pricePerUnit: 56000, fees: 500, notes: "5 oz zlata" },
      { assetId: gold.id, date: new Date("2023-08-15"), quantity: 3, pricePerUnit: 59000, fees: 300, notes: "Přikoupení" },
    ],
  });

  // Silver
  await prisma.purchase.createMany({
    data: [
      { assetId: silver.id, date: new Date("2023-02-10"), quantity: 50, pricePerUnit: 700, fees: 150, notes: "50 oz stříbra" },
    ],
  });

  // Real estate
  await prisma.purchase.createMany({
    data: [
      { assetId: reEstate.id, date: new Date("2020-06-01"), quantity: 1, pricePerUnit: 4200000, fees: 84000, notes: "Koupě bytu 2+kk Praha 3" },
    ],
  });

  // ─── Asset Prices (current) ───────────────────────────────────────────────────
  await prisma.assetPrice.createMany({
    data: [
      { assetId: btc.id, price: 1650000, source: PriceSource.API, fetchedAt: new Date() },
      { assetId: ada.id, price: 9.8, source: PriceSource.API, fetchedAt: new Date() },
      { assetId: gold.id, price: 62000, source: PriceSource.MANUAL, fetchedAt: new Date() },
      { assetId: silver.id, price: 730, source: PriceSource.MANUAL, fetchedAt: new Date() },
      { assetId: reEstate.id, price: 5800000, source: PriceSource.MANUAL, fetchedAt: new Date() },
      { assetId: xlm.id, price: 7.2, source: PriceSource.API, fetchedAt: new Date() },
      { assetId: doge.id, price: 3.8, source: PriceSource.API, fetchedAt: new Date() },
      { assetId: shib.id, price: 0.00065, source: PriceSource.API, fetchedAt: new Date() },
      { assetId: cro.id, price: 2.1, source: PriceSource.API, fetchedAt: new Date() },
    ],
  });

  console.log("✅ Seed complete!");
  console.log(`  Accounts: 3`);
  console.log(`  Categories: 10`);
  console.log(`  Assets: 9`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
