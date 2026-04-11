export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { PDFParse, VerbosityLevel } from "pdf-parse";
import { prisma } from "@/lib/prisma";
import { suggestCategory } from "@/lib/categorization";
import {
  detectPDFSource,
  parseAirBankPDF,
  parseRevolutPDF,
} from "@/lib/pdf-parsers/pdf-parser";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const accountId = (formData.get("accountId") as string | null)?.trim() ?? null;

  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  // Verify account exists
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Extract text from PDF (requires binary buffer, not text)
  let pdfText: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const parser = new PDFParse({
      data: uint8,
      password: process.env.AIRBANK_PDF_PASSWORD || undefined,
      verbosity: VerbosityLevel.ERRORS,
    });
    const result = await parser.getText();
    pdfText = result.text;
  } catch {
    return NextResponse.json({ error: "Nepodařilo se načíst PDF soubor" }, { status: 400 });
  }

  // Auto-detect bank from PDF content
  const source = detectPDFSource(pdfText);
  if (source === "UNKNOWN") {
    return NextResponse.json(
      { error: "Nepodporovaný formát PDF. Podporované banky: Air Bank, Revolut." },
      { status: 400 }
    );
  }

  const parsed =
    source === "AIRBANK" ? parseAirBankPDF(pdfText) : parseRevolutPDF(pdfText);

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

  // Deduplicate within the file
  const seenInFile = new Set<string>();
  const deduped = parsed.filter((tx) => {
    if (seenInFile.has(tx.sourceId)) return false;
    seenInFile.add(tx.sourceId);
    return true;
  });

  // Find sourceIds already in DB
  const existingRecords = await prisma.transaction.findMany({
    where: { importId: { in: deduped.map((t) => t.sourceId) } },
    select: { importId: true },
  });
  const existingIds = new Set(existingRecords.map((r) => r.importId!));

  const toInsert = deduped.filter((tx) => !existingIds.has(tx.sourceId));
  const skipped = parsed.length - toInsert.length;
  const errors: string[] = [];

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, skipped, errors });
  }

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
      amount: tx.amount,
      type: tx.type,
      description: tx.description,
      date: tx.date,
      importId: tx.sourceId,
      importSource: tx.source,
    });
  }

  if (rowsData.length === 0) {
    return NextResponse.json({ imported: 0, skipped: skipped + toInsert.length, errors });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.createMany({
        data: rowsData,
        skipDuplicates: true,
      });

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
