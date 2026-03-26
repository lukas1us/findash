export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { subMonths, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const months = Math.max(1, Number(searchParams.get("months") ?? "12") || 12);

  const since = startOfDay(subMonths(new Date(), months));

  try {
    const snapshots = await prisma.netWorthSnapshot.findMany({
      where: { date: { gte: since } },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(
      snapshots.map((s) => ({
        ...s,
        cashTotal: Number(s.cashTotal),
        investmentsTotal: Number(s.investmentsTotal),
        total: Number(s.total),
      }))
    );
  } catch {
    return NextResponse.json({ error: "Nepodařilo se načíst historii" }, { status: 500 });
  }
}
