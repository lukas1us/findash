import fs from "fs";
import path from "path";
import { clearFinance, testDb } from "../../helpers/db";
import { createTestAccount, createTestCategory } from "../../helpers/factories";
import { POST } from "@/app/api/finance/import/route";
import { parseBankCsv } from "@/lib/csv-parser";

const MOCK_DIR = path.join(process.cwd(), "mock_csvs");

function readCsv(relPath: string): string {
  return fs.readFileSync(path.join(MOCK_DIR, relPath), "utf-8");
}

function makeImportRequest(csvContent: string, accountId: string, bank: string) {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([csvContent], { type: "text/csv" }),
    "test.csv"
  );
  formData.append("accountId", accountId);
  formData.append("bank", bank);
  return new Request("http://localhost:3000/api/finance/import", {
    method: "POST",
    body: formData,
  });
}

let accountId: string;

beforeAll(async () => {
  await clearFinance();
});

beforeEach(async () => {
  await testDb.transaction.deleteMany();
  await testDb.budget.deleteMany();
  await testDb.category.deleteMany();
  await testDb.account.deleteMany();

  const account = await createTestAccount({ name: "Testovací účet", type: "CHECKING" });
  accountId = account.id;
  // Fallback expense category so auto-categorisation always has something to fall back to
  await createTestCategory({ name: "Ostatní výdaje", type: "EXPENSE" });
});

// ─── Parser unit tests — Air Bank ────────────────────────────────────────────

describe("parseBankCsv — Air Bank", () => {
  const csv = readCsv("airbank/transactions.csv");

  it("parses all data rows", () => {
    const rows = parseBankCsv(csv, "airbank");
    expect(rows).toHaveLength(5);
  });

  it("parses date correctly", () => {
    const rows = parseBankCsv(csv, "airbank");
    expect(rows[0].date).toBeInstanceOf(Date);
    expect(rows[0].date.getUTCFullYear()).toBe(2024);
    expect(rows[0].date.getUTCMonth()).toBe(2); // March = 2
    expect(rows[0].date.getUTCDate()).toBe(1);
  });

  it("parses negative amount as expense", () => {
    const rows = parseBankCsv(csv, "airbank");
    expect(rows[0].amount).toBe(-500);
  });

  it("parses positive amount as income", () => {
    const rows = parseBankCsv(csv, "airbank");
    const income = rows.find((r) => r.amount > 0);
    expect(income).toBeDefined();
    expect(income!.amount).toBe(25000);
  });

  it("uses externalId (Air Bank transaction ID) as rawRow", () => {
    const rows = parseBankCsv(csv, "airbank");
    // All rawRows should be the transaction IDs from the fixture
    expect(rows[0].rawRow).toBe("10000001");
    expect(rows[1].rawRow).toBe("10000002");
  });

  it("rawRow is unique per row (no collisions)", () => {
    const rows = parseBankCsv(csv, "airbank");
    const rawRows = rows.map((r) => r.rawRow);
    expect(new Set(rawRows).size).toBe(rawRows.length);
  });

  it("returns empty array for non-AirBank CSV", () => {
    const rows = parseBankCsv("col1,col2\na,b", "airbank");
    expect(rows).toHaveLength(0);
  });
});

// ─── Parser unit tests — Revolut ─────────────────────────────────────────────

describe("parseBankCsv — Revolut", () => {
  const csv = readCsv("revolut/transactions.csv");

  it("parses only COMPLETED rows (skips PENDING)", () => {
    const rows = parseBankCsv(csv, "revolut");
    // fixture has 5 rows; 1 is PENDING → 4 completed
    expect(rows).toHaveLength(4);
  });

  it("parses negative amount as expense", () => {
    const rows = parseBankCsv(csv, "revolut");
    const expense = rows.find((r) => r.description === "Kaufland");
    expect(expense).toBeDefined();
    expect(expense!.amount).toBe(-500);
  });

  it("parses positive amount as income", () => {
    const rows = parseBankCsv(csv, "revolut");
    const income = rows.find((r) => r.amount > 0);
    expect(income).toBeDefined();
    expect(income!.amount).toBe(30000);
  });

  it("populates rawRow for every row", () => {
    const rows = parseBankCsv(csv, "revolut");
    rows.forEach((r) => {
      expect(typeof r.rawRow).toBe("string");
      expect(r.rawRow.length).toBeGreaterThan(0);
    });
  });

  it("rawRow is unique per row (no collisions)", () => {
    const rows = parseBankCsv(csv, "revolut");
    const rawRows = rows.map((r) => r.rawRow);
    expect(new Set(rawRows).size).toBe(rawRows.length);
  });
});

// ─── Parser unit tests — Generic ─────────────────────────────────────────────

describe("parseBankCsv — Generic", () => {
  it("auto-detects semicolon delimiter and common column names", () => {
    const csv =
      "Datum;Objem;Popis\n" +
      "01.03.2024;-200,00;Nákup v obchodě\n" +
      "05.03.2024;1000,00;Příjem";
    const rows = parseBankCsv(csv, "generic");
    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(-200);
    expect(rows[1].amount).toBe(1000);
  });

  it("returns empty array when no recognisable date/amount columns", () => {
    const rows = parseBankCsv("col1,col2\na,b", "generic");
    expect(rows).toHaveLength(0);
  });
});

// ─── API endpoint ─────────────────────────────────────────────────────────────

describe("POST /api/finance/import", () => {
  const airbankCsv = readCsv("airbank/transactions.csv");
  const revolutCsv = readCsv("revolut/transactions.csv");

  it("imports all Air Bank transactions → 200", async () => {
    const res = await POST(makeImportRequest(airbankCsv, accountId, "airbank"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imported).toBe(5);
    expect(data.skipped).toBe(0);
  });

  it("creates transactions in the database", async () => {
    await POST(makeImportRequest(airbankCsv, accountId, "airbank"));
    const txs = await testDb.transaction.findMany({ where: { accountId } });
    expect(txs).toHaveLength(5);
  });

  it("sets importId and importSource on every created transaction", async () => {
    await POST(makeImportRequest(airbankCsv, accountId, "airbank"));
    const txs = await testDb.transaction.findMany({ where: { accountId } });
    txs.forEach((tx) => {
      expect(tx.importId).not.toBeNull();
      expect(tx.importSource).toBe("airbank");
    });
  });

  it("updates account balance after import", async () => {
    const before = (await testDb.account.findUniqueOrThrow({ where: { id: accountId } })).balance;
    await POST(makeImportRequest(airbankCsv, accountId, "airbank"));
    const after = (await testDb.account.findUniqueOrThrow({ where: { id: accountId } })).balance;
    // Net: 25000 − 500 − 1200.50 − 800 − 299 = 22200.50
    expect(after - before).toBeCloseTo(22200.5, 1);
  });

  it("deduplication — second import of same file inserts 0 new transactions", async () => {
    await POST(makeImportRequest(airbankCsv, accountId, "airbank"));
    const res2 = await POST(makeImportRequest(airbankCsv, accountId, "airbank"));
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.imported).toBe(0);
    expect(data2.skipped).toBe(5);
    const txs = await testDb.transaction.findMany({ where: { accountId } });
    expect(txs).toHaveLength(5);
  });

  it("deduplication — balance is not updated on second import", async () => {
    await POST(makeImportRequest(airbankCsv, accountId, "airbank"));
    const balanceAfterFirst = (await testDb.account.findUniqueOrThrow({ where: { id: accountId } })).balance;
    await POST(makeImportRequest(airbankCsv, accountId, "airbank"));
    const balanceAfterSecond = (await testDb.account.findUniqueOrThrow({ where: { id: accountId } })).balance;
    expect(balanceAfterSecond).toBeCloseTo(balanceAfterFirst, 5);
  });

  it("imports Revolut CSV (COMPLETED only) → 4 transactions", async () => {
    const res = await POST(makeImportRequest(revolutCsv, accountId, "revolut"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imported).toBe(4);
  });

  it("returns 400 when file is missing", async () => {
    const formData = new FormData();
    formData.append("accountId", accountId);
    formData.append("bank", "airbank");
    const res = await POST(
      new Request("http://localhost:3000/api/finance/import", { method: "POST", body: formData })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/file/i);
  });

  it("returns 400 when accountId is missing", async () => {
    const formData = new FormData();
    formData.append("file", new Blob([airbankCsv], { type: "text/csv" }), "t.csv");
    formData.append("bank", "airbank");
    const res = await POST(
      new Request("http://localhost:3000/api/finance/import", { method: "POST", body: formData })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when bank is invalid", async () => {
    const res = await POST(makeImportRequest(airbankCsv, accountId, "unknown_bank"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown accountId", async () => {
    const res = await POST(makeImportRequest(airbankCsv, "nonexistent-id", "airbank"));
    expect(res.status).toBe(404);
  });
});
