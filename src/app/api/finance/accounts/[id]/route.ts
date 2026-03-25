export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const account = await prisma.account.update({
    where: { id: params.id },
    data: {
      name: body.name,
      type: body.type,
      currency: body.currency,
      balance: Number(body.balance),
    },
  });
  return NextResponse.json(account);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.account.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
