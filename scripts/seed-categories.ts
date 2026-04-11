import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, CategoryType } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CATEGORIES = [
  // Income
  { name: "Plat",              type: CategoryType.INCOME,  color: "#22c55e", icon: "briefcase" },
  { name: "Freelance",         type: CategoryType.INCOME,  color: "#10b981", icon: "laptop" },
  { name: "Ostatní příjmy",    type: CategoryType.INCOME,  color: "#6ee7b7", icon: "plus-circle" },
  // Expenses
  { name: "Nájem",             type: CategoryType.EXPENSE, color: "#ef4444", icon: "home" },
  { name: "Jídlo",             type: CategoryType.EXPENSE, color: "#f97316", icon: "utensils" },
  { name: "Doprava",           type: CategoryType.EXPENSE, color: "#3b82f6", icon: "car" },
  { name: "Investice",         type: CategoryType.EXPENSE, color: "#8b5cf6", icon: "trending-up" },
  { name: "Zábava",            type: CategoryType.EXPENSE, color: "#ec4899", icon: "film" },
  { name: "Zdraví",            type: CategoryType.EXPENSE, color: "#06b6d4", icon: "heart" },
  { name: "Energie a služby",  type: CategoryType.EXPENSE, color: "#f59e0b", icon: "zap" },
  { name: "Nakupování",        type: CategoryType.EXPENSE, color: "#84cc16", icon: "shopping-bag" },
  { name: "Ostatní",           type: CategoryType.EXPENSE, color: "#94a3b8", icon: "tag" },
];

async function main() {
  console.log("Seeding categories...");

  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);

  let catCreated = 0;
  let budgetCreated = 0;

  for (const cat of CATEGORIES) {
    let category = await prisma.category.findFirst({ where: { name: cat.name } });
    if (!category) {
      category = await prisma.category.create({ data: cat });
      catCreated++;
    }

    // Only create budgets for expense categories
    if (cat.type === CategoryType.EXPENSE) {
      const existingBudget = await prisma.budget.findFirst({
        where: { categoryId: category.id, month: currentMonth },
      });
      if (!existingBudget) {
        await prisma.budget.create({
          data: { categoryId: category.id, amount: 1000, month: currentMonth },
        });
        budgetCreated++;
      }
    }
  }

  console.log(`Done — ${catCreated} categories created, ${CATEGORIES.length - catCreated} already existed.`);
  console.log(`       ${budgetCreated} budgets created for current month.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
