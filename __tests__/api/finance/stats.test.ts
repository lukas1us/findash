import { clearFinance, testDb } from "../../helpers/db";
import { createTestAccount, createTestCategory } from "../../helpers/factories";
import { GET } from "@/app/api/finance/stats/route";
import { startOfMonth, subMonths } from "date-fns";

const BASE = "http://localhost:3000";

function req(path: string) {
  return new Request(`${BASE}${path}`);
}

let accountId: string;
let incomeCatId: string;
let expenseCatId: string;

beforeAll(async () => {
  await clearFinance();

  const account = await createTestAccount({ name: "Stats Account", balance: 0 });
  const incCat = await createTestCategory({ name: "Salary", type: "INCOME" });
  const expCat = await createTestCategory({ name: "Bills", type: "EXPENSE" });
  accountId = account.id;
  incomeCatId = incCat.id;
  expenseCatId = expCat.id;

  // Insert 6 months of transactions (including current month)
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const month = subMonths(now, i);
    const txDate = startOfMonth(month);
    txDate.setDate(5); // 5th of each month

    await testDb.transaction.create({
      data: {
        accountId,
        categoryId: incomeCatId,
        amount: 50000,
        type: "INCOME",
        date: txDate,
        description: "Salary",
      },
    });
    await testDb.transaction.create({
      data: {
        accountId,
        categoryId: expenseCatId,
        amount: 20000,
        type: "EXPENSE",
        date: txDate,
        description: "Bills",
      },
    });
  }
});

describe("GET /api/finance/stats — current month summary", () => {
  it("returns currentMonth with income and expense fields", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.currentMonth).toBeDefined();
    expect(typeof data.currentMonth.income).toBe("number");
    expect(typeof data.currentMonth.expense).toBe("number");
  });

  it("income and expense values are correct for current month", async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.currentMonth.income).toBe(50000);
    expect(data.currentMonth.expense).toBe(20000);
  });

  it("totalSavings = totalIncome - totalExpense", async () => {
    const res = await GET();
    const data = await res.json();
    const { income, expense } = data.currentMonth;
    const savings = income - expense;
    expect(savings).toBe(30000);
  });
});

describe("GET /api/finance/stats — cash flow", () => {
  it("returns last 6 months of data", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.cashFlow)).toBe(true);
    expect(data.cashFlow).toHaveLength(6);
  });

  it("each month has month, income, expense fields", async () => {
    const res = await GET();
    const data = await res.json();
    for (const month of data.cashFlow) {
      expect(typeof month.month).toBe("string");
      expect(typeof month.income).toBe("number");
      expect(typeof month.expense).toBe("number");
    }
  });

  it("returns expensesByCategory pie data", async () => {
    const res = await GET();
    const data = await res.json();
    expect(Array.isArray(data.expensesByCategory)).toBe(true);
    if (data.expensesByCategory.length > 0) {
      expect(data.expensesByCategory[0]).toMatchObject({
        name: expect.any(String),
        value: expect.any(Number),
        color: expect.any(String),
      });
    }
  });
});
