export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ConfirmRequest, ConfirmResult } from "@/lib/csv-parsers/types";

export async function POST(request: Request) {
  const body: ConfirmRequest = await request.json();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  if (body.module === "finance") {
    if (!body.accountId) {
      return NextResponse.json({ error: "accountId je povinné pro finanční import" }, { status: 400 });
    }

    const rows = body.financeRows ?? [];

    for (const row of rows) {
      if (!row.date || !row.categoryId || row.amount == null) {
        errors.push(`Řádek přeskočen: chybí date/categoryId/amount`);
        skipped++;
        continue;
      }

      try {
        // Dedup check
        if (row.externalId) {
          const exists = await prisma.transaction.findFirst({
            where: { externalId: row.externalId },
            select: { id: true },
          });
          if (exists) { skipped++; continue; }
        }

        const dateObj = new Date(row.date + "T00:00:00Z");

        await prisma.$transaction(async (tx) => {
          await tx.transaction.create({
            data: {
              accountId:        body.accountId!,
              categoryId:       row.categoryId,
              amount:           row.amount,
              type:             row.type,
              description:      row.description || null,
              date:             dateObj,
              externalId:       row.externalId ?? null,
              originalCurrency: row.originalCurrency ?? null,
              originalAmount:   row.originalAmount ?? null,
              exchangeRate:     row.exchangeRate ?? null,
            },
          });

          const delta = row.type === "INCOME" ? row.amount : -row.amount;
          await tx.account.update({
            where: { id: body.accountId! },
            data: { balance: { increment: delta } },
          });
        });

        imported++;
      } catch (err) {
        errors.push(`Chyba při ukládání řádku ${row.date}: ${String(err)}`);
        skipped++;
      }
    }
  } else {
    // investments
    const rows = body.investmentRows ?? [];

    for (const row of rows) {
      if (!row.date || !row.assetId || row.quantity == null) {
        errors.push(`Řádek přeskočen: chybí date/assetId/quantity`);
        skipped++;
        continue;
      }

      try {
        // Dedup check
        if (row.externalId) {
          const exists = await prisma.purchase.findFirst({
            where: { externalId: row.externalId },
            select: { id: true },
          });
          if (exists) { skipped++; continue; }
        }

        await prisma.purchase.create({
          data: {
            assetId:      row.assetId,
            date:         new Date(row.date + "T00:00:00Z"),
            quantity:     row.quantity,
            pricePerUnit: row.pricePerUnit,
            fees:         row.fees ?? 0,
            notes:        row.notes ?? null,
            externalId:   row.externalId ?? null,
          },
        });

        imported++;
      } catch (err) {
        errors.push(`Chyba při ukládání nákupu ${row.date}: ${String(err)}`);
        skipped++;
      }
    }
  }

  const result: ConfirmResult = { imported, skipped, errors };
  return NextResponse.json(result);
}
