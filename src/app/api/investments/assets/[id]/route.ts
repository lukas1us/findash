export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const asset = await prisma.asset.update({
    where: { id: params.id },
    data: { name: body.name, ticker: body.ticker, type: body.type, currency: body.currency },
  });
  return NextResponse.json(asset);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.asset.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
