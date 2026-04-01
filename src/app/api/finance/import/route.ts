export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { parseBankCsv, type BankFormat } from "@/lib/csv-parser";
import { suggestCategory } from "@/lib/categorization";

const VALID_BANKS: BankFormat[] = ["airbank", "revolut", "generic"];

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const accountId = (formData.get("accountId") as string | null)?.trim() ?? null;
  const bank = (formData.get("bank") as string | null)?.trim() ?? null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }
  if (!bank || !VALID_BANKS.includes(bank as BankFormat)) {
    return NextResponse.json(
      { error: "bank must be one of: airbank, revolut, generic" },
      { status: 400 }
    );
  }

  // Verify account exists
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Read & parse the CSV
  const content = await file.text();
  const parsed = parseBankCsv(content, bank as BankFormat);

  if (parsed.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped: 0,
      errors: ["Soubor neobsahuje žádné parsovatelné transakce"],
    });
  }

  // Fetch categories for auto-categorisation
  const categories = await prisma.category.findMany();
  const fallbackCategory = categories.find((c) => c.type === "EXPENSE");

  // Compute importId (SHA-256 of reconstructed row string) for every row
  const withIds = parsed.map((tx) => ({
    ...tx,
    importId: createHash("sha256").update(tx.rawRow).digest("hex"),
  }));

  // Deduplicate within the file (identical rows appearing twice)
  const seenInFile = new Set<string>();
  const deduped = withIds.filter((tx) => {
    if (seenInFile.has(tx.importId)) return false;
    seenInFile.add(tx.importId);
    return true;
  });

  // Find importIds that already exist in the database
  const existingRecords = await prisma.transaction.findMany({
    where: { importId: { in: deduped.map((t) => t.importId) } },
    select: { importId: true },
  });
  const existingIds = new Set(existingRecords.map((r) => r.importId!));

  const toInsert = deduped.filter((tx) => !existingIds.has(tx.importId));
  const skipped = withIds.length - toInsert.length;
  const errors: string[] = [];

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, skipped, errors });
  }

  // Resolve categories and build DB rows
  type TxRow = {
    accountId: string;
    categoryId: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    description: string;
    date: Date;
    importId: string;
    importSource: string;
  };

  const rowsData: TxRow[] = [];
  for (const tx of toInsert) {
    const categoryId =
      suggestCategory(tx.description, categories) ?? fallbackCategory?.id;

    if (!categoryId) {
      errors.push(`Nelze přiřadit kategorii: ${tx.description.slice(0, 60)}`);
      continue;
    }

    rowsData.push({
      accountId,
      categoryId,
      amount: Math.abs(tx.amount),
      type: tx.amount >= 0 ? "INCOME" : "EXPENSE",
      description: tx.description,
      date: tx.date,
      importId: tx.importId,
      importSource: bank,
    });
  }

  if (rowsData.length === 0) {
    return NextResponse.json({ imported: 0, skipped: skipped + toInsert.length, errors });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.createMany({
        data: rowsData,
        skipDuplicates: true, // safety net for any within-batch unique violations
      });

      // Update account balance in the same DB transaction
      const delta = rowsData.reduce(
        (sum, row) => sum + (row.type === "INCOME" ? row.amount : -row.amount),
        0
      );
      if (delta !== 0) {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: delta } },
        });
      }

      return created.count;
    });

    return NextResponse.json({
      imported: result,
      skipped: skipped + (rowsData.length - result),
      errors,
    });
  } catch {
    return NextResponse.json({ error: "Import selhal — databázová chyba" }, { status: 500 });
  }
}
