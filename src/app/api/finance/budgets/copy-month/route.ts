export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseISO, startOfMonth } from "date-fns";

const schema = z.object({
  fromMonth: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM"),
  toMonth: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM"),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.errors[0]?.path[0]?.toString();
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input", field },
      { status: 400 }
    );
  }

  const { fromMonth, toMonth } = parsed.data;
  const from = startOfMonth(parseISO(`${fromMonth}-01`));
  const to = startOfMonth(parseISO(`${toMonth}-01`));

  const sourceBudgets = await prisma.budget.findMany({ where: { month: from } });

  if (sourceBudgets.length === 0) {
    return NextResponse.json({ copied: 0 });
  }

  let copied = 0;
  for (const b of sourceBudgets) {
    await prisma.budget.upsert({
      where: { categoryId_month: { categoryId: b.categoryId, month: to } },
      update: { amount: b.amount },
      create: { categoryId: b.categoryId, amount: b.amount, month: to },
    });
    copied++;
  }

  return NextResponse.json({ copied });
}
