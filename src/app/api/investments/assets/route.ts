export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const assets = await prisma.asset.findMany({
    include: {
      purchases: { orderBy: { date: "asc" } },
      prices: { orderBy: { fetchedAt: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(assets);
}

export async function POST(request: Request) {
  const body = await request.json();
  const asset = await prisma.asset.create({
    data: {
      name: body.name,
      ticker: body.ticker,
      type: body.type,
      currency: body.currency ?? "CZK",
    },
  });
  return NextResponse.json(asset, { status: 201 });
}
