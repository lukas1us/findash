export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["CRYPTO", "REAL_ESTATE", "GOLD_SILVER", "OTHER"];

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

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

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
