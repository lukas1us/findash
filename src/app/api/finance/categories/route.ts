export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const body = await request.json();
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
