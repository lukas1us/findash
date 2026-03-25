export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const purchase = await prisma.purchase.update({
    where: { id: params.id },
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
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.purchase.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
