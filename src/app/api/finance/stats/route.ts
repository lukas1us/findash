export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export async function GET() {
  const now = new Date();

  // Current month summary
  const currentStart = startOfMonth(now);
  const currentEnd = endOfMonth(now);

  const [currentIncome, currentExpense] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: "INCOME", date: { gte: currentStart, lte: currentEnd } },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: "EXPENSE", date: { gte: currentStart, lte: currentEnd } },
    }),
  ]);

  // Last 6 months cash flow
  const months = Array.from({ length: 6 }, (_, i) => subMonths(now, 5 - i));
  const cashFlow = await Promise.all(
    months.map(async (m) => {
      const start = startOfMonth(m);
      const end = endOfMonth(m);
      const [inc, exp] = await Promise.all([
        prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { type: "INCOME", date: { gte: start, lte: end } },
        }),
        prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { type: "EXPENSE", date: { gte: start, lte: end } },
        }),
      ]);
      return {
        month: format(m, "MMM yy"),
        income: inc._sum.amount ?? 0,
        expense: exp._sum.amount ?? 0,
      };
    })
  );

  // Expenses by category (current month)
  const expensesByCategory = await prisma.transaction.groupBy({
    by: ["categoryId"],
    _sum: { amount: true },
    where: { type: "EXPENSE", date: { gte: currentStart, lte: currentEnd } },
    orderBy: { _sum: { amount: "desc" } },
  });

  const categoryIds = expensesByCategory.map((e) => e.categoryId);
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const pieData = expensesByCategory.map((e) => ({
    name: catMap[e.categoryId]?.name ?? "Ostatní",
    value: e._sum.amount ?? 0,
    color: catMap[e.categoryId]?.color ?? "#6366f1",
  }));

  return NextResponse.json({
    currentMonth: {
      income: currentIncome._sum.amount ?? 0,
      expense: currentExpense._sum.amount ?? 0,
    },
    cashFlow,
    expensesByCategory: pieData,
  });
}
