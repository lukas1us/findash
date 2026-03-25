export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["CHECKING", "SAVINGS", "CASH"];

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(accounts);
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

  const account = await prisma.account.create({
    data: {
      name: body.name,
      type: body.type,
      currency: body.currency ?? "CZK",
      balance: Number(body.balance) || 0,
    },
  });
  return NextResponse.json(account, { status: 201 });
}
