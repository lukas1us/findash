export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const budget = await prisma.budget.update({
    where: { id: params.id },
    data: { amount: Number(body.amount) },
    include: { category: true },
  });
  return NextResponse.json(budget);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.budget.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
