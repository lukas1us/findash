export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get("assetId");

  const purchases = await prisma.purchase.findMany({
    where: assetId ? { assetId } : undefined,
    include: { asset: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(purchases);
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.assetId) {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }
  if (body.quantity === undefined || body.quantity === null || body.quantity === "") {
    return NextResponse.json({ error: "quantity is required" }, { status: 400 });
  }
  if (body.pricePerUnit === undefined || body.pricePerUnit === null || body.pricePerUnit === "") {
    return NextResponse.json({ error: "pricePerUnit is required" }, { status: 400 });
  }

  // Verify asset exists
  const asset = await prisma.asset.findUnique({ where: { id: body.assetId } });
  if (!asset) {
    return NextResponse.json({ error: "assetId does not exist" }, { status: 400 });
  }

  const purchase = await prisma.purchase.create({
    data: {
      assetId: body.assetId,
      date: new Date(body.date),
      quantity: Number(body.quantity),
      pricePerUnit: Number(body.pricePerUnit),
      fees: Number(body.fees ?? 0),
      notes: body.notes,
    },
    include: { asset: true },
  });
  return NextResponse.json(purchase, { status: 201 });
}
