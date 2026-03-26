export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const types  = searchParams.get("type")?.split(",").filter(Boolean) ?? [];
  const page   = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));
  const sort   = searchParams.get("sort") ?? "date_desc";

  const orderBy = sort === "date_asc"
    ? { date: "asc" as const }
    : { date: "desc" as const };

  const where: Record<string, unknown> = { assetId: params.id };
  if (types.length) where.type = { in: types };

  const [total, transactions] = await Promise.all([
    prisma.cryptoTransaction.count({ where }),
    prisma.cryptoTransaction.findMany({
      where,
      orderBy,
      skip:  (page - 1) * limit,
      take:  limit,
    }),
  ]);

  return NextResponse.json({
    transactions,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}
