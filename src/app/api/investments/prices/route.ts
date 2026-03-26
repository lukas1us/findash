export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getPricesSchema,
  postPriceSchema,
  patchPriceSchema,
  deletePriceSchema,
} from "@/lib/validators/investments/prices";

function validationError(error: ZodError) {
  const first = error.issues[0];
  const field = first?.path[0]?.toString();
  return NextResponse.json(
    { error: first?.message ?? "Validation error", ...(field ? { field } : {}) },
    { status: 400 }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());
  const result = getPricesSchema.safeParse(raw);
  if (!result.success) return validationError(result.error);

  try {
    const prices = await prisma.assetPrice.findMany({
      include: { asset: true },
      orderBy: { fetchedAt: "desc" },
    });
    // Get only latest per asset
    const latest = new Map<string, (typeof prices)[0]>();
    for (const p of prices) {
      if (!latest.has(p.assetId)) latest.set(p.assetId, p);
    }
    return NextResponse.json(Array.from(latest.values()));
  } catch {
    return NextResponse.json({ error: "Failed to fetch prices" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = postPriceSchema.safeParse(body);
  if (!result.success) return validationError(result.error);

  const { assetId, price, date, source } = result.data;

  try {
    const created = await prisma.assetPrice.create({
      data: {
        assetId,
        price,
        ...(source ? { source: source as "MANUAL" | "API" } : {}),
        fetchedAt: new Date(date),
      },
      include: { asset: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Price entry already exists for this asset and date" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create price entry" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = patchPriceSchema.safeParse(body);
  if (!result.success) return validationError(result.error);

  const { id, price } = result.data;

  try {
    const updated = await prisma.assetPrice.update({
      where: { id },
      data: { price },
      include: { asset: true },
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Price entry not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update price entry" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = Object.fromEntries(searchParams.entries());
  const result = deletePriceSchema.safeParse(raw);
  if (!result.success) return validationError(result.error);

  const { id } = result.data;

  try {
    await prisma.assetPrice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return NextResponse.json({ error: "Price entry not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete price entry" }, { status: 500 });
  }
}
