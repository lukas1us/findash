export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["INCOME", "EXPENSE"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const categories = await prisma.category.findMany({
    where: type ? { type: type as "INCOME" | "EXPENSE" } : undefined,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(categories);
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

  const category = await prisma.category.create({
    data: {
      name: body.name,
      type: body.type,
      color: body.color ?? "#6366f1",
      icon: body.icon ?? "tag",
    },
  });
  return NextResponse.json(category, { status: 201 });
}
