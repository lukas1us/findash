export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

function isNotFound(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025"
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  try {
    const purchase = await prisma.purchase.update({
      where: { id },
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
    return NextResponse.json(purchase);
  } catch (err) {
    if (isNotFound(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.purchase.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (isNotFound(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}
