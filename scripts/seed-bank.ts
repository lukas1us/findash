import "dotenv/config";
import * as path from "path";
import { PrismaClient, CategoryType, AccountType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseBankPDF, detectCategory, parseCzechAmount, parseUsAmount } from "../src/lib/pdf-parsers/pdf-parser";
import type { ParsedBankTransaction } from "../src/lib/pdf-parsers/pdf-parser";

// ─── Prisma setup ─────────────────────────────────────────────────────────────

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const accountCache: Record<string, string> = {};
const categoryCache: Record<string, string> = {};

async function findOrCreateAccount(name: string): Promise<string> {
  if (accountCache[name]) return accountCache[name];
  let acc = await prisma.account.findFirst({ where: { name } });
  if (!acc) {
    acc = await prisma.account.create({
      data: { name, type: AccountType.CHECKING, currency: "CZK", balance: 0 },
    });
  }
  accountCache[name] = acc.id;
  return acc.id;
}

async function findOrCreateCategory(name: string, type: CategoryType): Promise<string> {
  const key = `${name}_${type}`;
  if (categoryCache[key]) return categoryCache[key];
  let cat = await prisma.category.findFirst({ where: { name, type } });
  if (!cat) {
    const COLOR: Record<string, string> = {
      Nájem: "#ef4444",
      Jídlo: "#f97316",
      Doprava: "#3b82f6",
      Zábava: "#8b5cf6",
      Ostatní: "#6366f1",
    };
    cat = await prisma.category.create({
      data: { name, type, color: COLOR[name] ?? "#6366f1", icon: "tag" },
    });
  }
  categoryCache[key] = cat.id;
  return cat.id;
}

// ─── Closing balance extraction ───────────────────────────────────────────────

function extractAirBankClosingBalance(text: string): number {
  const m = text.match(/Konečný zůstatek:\s*([-\d\s]+,\d{2})/);
  return m ? parseCzechAmount(m[1]) : 0;
}

function extractRevolutClosingBalance(text: string): number {
  const line = text.match(/Account \(Current Account\)[^\n]+/)?.[0] ?? "";
  const amounts = Array.from(line.matchAll(/([\d,]+\.?\d*)\s+CZK/g)).map((m) =>
    parseUsAmount(m[1])
  );
  return amounts.length > 0 ? amounts[amounts.length - 1] : 0;
}

// ─── Import one PDF ───────────────────────────────────────────────────────────

async function importPDF(
  filePath: string,
  accountName: string,
  password?: string
): Promise<{ parsed: number; inserted: number; skipped: number; foreignWarnings: number }> {
  const { PDFParse, VerbosityLevel } = await import("pdf-parse");
  const fs = await import("fs");

  // Extract raw text for closing balance
  const buf = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(buf);
  const parser = new PDFParse({
    data: uint8,
    password: password || undefined,
    verbosity: VerbosityLevel.ERRORS,
  });
  const { text } = await parser.getText();

  // Extract closing balance and update account
  const accountId = await findOrCreateAccount(accountName);
  const closingBalance =
    accountName === "Air Bank"
      ? extractAirBankClosingBalance(text)
      : extractRevolutClosingBalance(text);

  if (closingBalance > 0) {
    await prisma.account.update({
      where: { id: accountId },
      data: { balance: closingBalance },
    });
  }

  // Parse transactions
  const txs = await parseBankPDF(filePath, password);
  const parsed = txs.length;
  let inserted = 0;
  let skipped = 0;
  let foreignWarnings = 0;

  for (const tx of txs) {
    // Skip if sourceId already exists
    const exists = await prisma.transaction.findFirst({
      where: { externalId: tx.sourceId },
      select: { id: true },
    });
    if (exists) { skipped++; continue; }

    const catName = tx.type === "INCOME" ? "Ostatní" : detectCategory(tx.description);
    const catType = tx.type === "INCOME" ? CategoryType.INCOME : CategoryType.EXPENSE;
    const categoryId = await findOrCreateCategory(catName, catType);

    if (tx.originalCurrency && tx.originalCurrency !== "CZK" && !tx.exchangeRate) {
      foreignWarnings++;
    }

    try {
      await prisma.$transaction(async (txn) => {
        await txn.transaction.create({
          data: {
            accountId,
            categoryId,
            amount: tx.amount,
            type: tx.type,
            description: tx.description,
            date: tx.date,
            externalId: tx.sourceId,
            originalCurrency: tx.originalCurrency ?? null,
            originalAmount: tx.originalAmount ?? null,
            exchangeRate: tx.exchangeRate ?? null,
          },
        });
        const delta = tx.type === "INCOME" ? tx.amount : -tx.amount;
        await txn.account.update({
          where: { id: accountId },
          data: { balance: { increment: delta } },
        });
      });
      inserted++;
    } catch {
      skipped++;
    }
  }

  return { parsed, inserted, skipped, foreignWarnings };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const AIRBANK_PDF = path.join(__dirname, "..", "mock_csvs", "airbank_example.pdf");
  const REVOLUT_PDF = path.join(__dirname, "..", "mock_csvs", "revolut_example.pdf");
  const AIRBANK_PASSWORD = process.env.AIRBANK_PDF_PASSWORD;

  // Delete existing PDF-seeded transactions to allow re-runs
  await prisma.transaction.deleteMany({
    where: { externalId: { startsWith: "AIRBANK_PDF_" } },
  });
  await prisma.transaction.deleteMany({
    where: { externalId: { startsWith: "REVOLUT_PDF_" } },
  });

  // Reset account balances that will be managed by this script
  const airAcc = await prisma.account.findFirst({ where: { name: "Air Bank" } });
  if (airAcc) await prisma.account.update({ where: { id: airAcc.id }, data: { balance: 0 } });
  const revAcc = await prisma.account.findFirst({ where: { name: "Revolut" } });
  if (revAcc) await prisma.account.update({ where: { id: revAcc.id }, data: { balance: 0 } });

  // Air Bank
  const abResult = await importPDF(AIRBANK_PDF, "Air Bank", AIRBANK_PASSWORD);

  // Revolut
  const revResult = await importPDF(REVOLUT_PDF, "Revolut");

  // Summary
  console.log("\n── Seed summary ──────────────────────────────────────────────");
  console.log(
    `Air Bank PDF:  parsed ${abResult.parsed} | inserted ${abResult.inserted} | skipped ${abResult.skipped}`
  );
  console.log(
    `Revolut PDF:   parsed ${revResult.parsed} | inserted ${revResult.inserted} | skipped ${revResult.skipped}${revResult.foreignWarnings > 0 ? ` (foreign currency warnings: ${revResult.foreignWarnings})` : ""}`
  );
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
