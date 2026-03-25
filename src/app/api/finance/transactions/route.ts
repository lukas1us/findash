export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  const categoryId = searchParams.get("categoryId");
  const type = searchParams.get("type");
  const limit = searchParams.get("limit");

  const where: Record<string, unknown> = {};

  if (month) {
    const d = parseISO(`${month}-01`);
    where.date = { gte: startOfMonth(d), lte: endOfMonth(d) };
  }
  if (categoryId) where.categoryId = categoryId;
  if (type) where.type = type;

  const transactions = await prisma.transaction.findMany({
    where,
    include: { account: true, category: true },
    orderBy: { date: "desc" },
    ...(limit ? { take: Number(limit) } : {}),
  });
  return NextResponse.json(transactions);
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }
  if (body.amount === undefined || body.amount === null || body.amount === "") {
    return NextResponse.json({ error: "amount is required" }, { status: 400 });
  }
  if (Number(body.amount) < 0) {
    return NextResponse.json({ error: "amount must be non-negative" }, { status: 400 });
  }

  // Verify account exists
  const account = await prisma.account.findUnique({ where: { id: body.accountId } });
  if (!account) {
    return NextResponse.json({ error: "accountId does not exist" }, { status: 400 });
  }

  const transaction = await prisma.transaction.create({
    data: {
      accountId: body.accountId,
      categoryId: body.categoryId,
      amount: Number(body.amount),
      type: body.type,
      description: body.description,
      date: new Date(body.date),
    },
    include: { account: true, category: true },
  });

  // Update account balance
  const delta = transaction.type === "INCOME" ? transaction.amount : -transaction.amount;
  await prisma.account.update({
    where: { id: body.accountId },
    data: { balance: { increment: delta } },
  });

  return NextResponse.json(transaction, { status: 201 });
}
