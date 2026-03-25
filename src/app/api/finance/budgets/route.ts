export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseISO, startOfMonth } from "date-fns";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM

  const where: Record<string, unknown> = {};
  if (month) {
    const d = startOfMonth(parseISO(`${month}-01`));
    where.month = d;
  }

  const budgets = await prisma.budget.findMany({
    where,
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });
  return NextResponse.json(budgets);
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.categoryId) {
    return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
  }
  if (body.amount === undefined || body.amount === null || body.amount === "") {
    return NextResponse.json({ error: "amount is required" }, { status: 400 });
  }
  if (!body.month) {
    return NextResponse.json({ error: "month is required" }, { status: 400 });
  }

  const month = startOfMonth(parseISO(`${body.month}-01`));
  const budget = await prisma.budget.upsert({
    where: { categoryId_month: { categoryId: body.categoryId, month } },
    update: { amount: Number(body.amount) },
    create: { categoryId: body.categoryId, amount: Number(body.amount), month },
    include: { category: true },
  });
  return NextResponse.json(budget, { status: 201 });
}
