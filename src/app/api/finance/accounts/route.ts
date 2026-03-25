export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const account = await prisma.account.create({
    data: {
      name: body.name,
      type: body.type,
      currency: body.currency ?? "CZK",
      balance: Number(body.balance) ?? 0,
    },
  });
  return NextResponse.json(account, { status: 201 });
}
