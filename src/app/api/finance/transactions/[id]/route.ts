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
  { params }: { params: { id: string } }
) {
  const body = await request.json();

  // Revert old balance effect
  const old = await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!old) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const oldDelta = old.type === "INCOME" ? -old.amount : old.amount;
  await prisma.account.update({
    where: { id: old.accountId },
    data: { balance: { increment: oldDelta } },
  });

  try {
    const transaction = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        accountId: body.accountId,
        categoryId: body.categoryId,
        amount: Number(body.amount),
        type: body.type,
        description: body.description,
        date: new Date(body.date),
      },
      include: { account: true, category: true },
    });

    // Apply new balance effect
    const newDelta =
      transaction.type === "INCOME" ? transaction.amount : -transaction.amount;
    await prisma.account.update({
      where: { id: transaction.accountId },
      data: { balance: { increment: newDelta } },
    });

    return NextResponse.json(transaction);
  } catch (err) {
    if (isNotFound(err)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } }
) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: params.id },
  });
  if (!transaction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const delta =
    transaction.type === "INCOME" ? -transaction.amount : transaction.amount;
  await prisma.account.update({
    where: { id: transaction.accountId },
    data: { balance: { increment: delta } },
  });

  await prisma.transaction.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
