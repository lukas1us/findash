export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const prices = await prisma.assetPrice.findMany({
    include: { asset: true },
    orderBy: { fetchedAt: "desc" },
  });
  // Get only latest per asset
  const latest = new Map<string, (typeof prices)[0]>();
  for (const p of prices) {
    if (!latest.has(p.assetId)) latest.set(p.assetId, p);
  }
  return NextResponse.json(Array.from(latest.values()));
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.assetId) {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }
  if (body.price === undefined || body.price === null || body.price === "") {
    return NextResponse.json({ error: "price is required" }, { status: 400 });
  }

  const price = await prisma.assetPrice.create({
    data: {
      assetId: body.assetId,
      price: Number(body.price),
      source: body.source ?? "MANUAL",
    },
    include: { asset: true },
  });
  return NextResponse.json(price, { status: 201 });
}
