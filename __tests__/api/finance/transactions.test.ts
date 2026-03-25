import { clearFinance, testDb } from "../../helpers/db";
import {
  createTestAccount,
  createTestCategory,
  createTestTransaction,
} from "../../helpers/factories";
import { GET, POST } from "@/app/api/finance/transactions/route";
import { PUT, DELETE } from "@/app/api/finance/transactions/[id]/route";

const BASE = "http://localhost:3000";

function req(path: string, init?: RequestInit) {
  return new Request(`${BASE}${path}`, init);
}

function jsonReq(path: string, method: string, body: unknown) {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Seeded before suite
let accountId: string;
let incomeCategoryId: string;
let expenseCategoryId: string;

beforeAll(async () => {
  await clearFinance();
  const account = await createTestAccount({ name: "Main Account", balance: 0 });
  const incCat = await createTestCategory({ name: "Salary", type: "INCOME" });
  const expCat = await createTestCategory({ name: "Food", type: "EXPENSE" });
  accountId = account.id;
  incomeCategoryId = incCat.id;
  expenseCategoryId = expCat.id;
});

beforeEach(async () => {
  // Clear transactions only, preserve account + categories
  await testDb.transaction.deleteMany();
  // Reset balance
  await testDb.account.update({
    where: { id: accountId },
    data: { balance: 0 },
  });
});

describe("GET /api/finance/transactions", () => {
  it("returns all transactions", async () => {
    await createTestTransaction(accountId, expenseCategoryId, { amount: 100 });
    await createTestTransaction(accountId, incomeCategoryId, {
      amount: 500,
      type: "INCOME",
    });
    const res = await GET(req("/api/finance/transactions"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("filters by month", async () => {
    await createTestTransaction(accountId, expenseCategoryId, {
      amount: 100,
      date: new Date("2024-03-15"),
    });
    await createTestTransaction(accountId, expenseCategoryId, {
      amount: 200,
      date: new Date("2024-04-10"),
    });
    const res = await GET(req("/api/finance/transactions?month=2024-03"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].amount).toBe(100);
  });

  it("filters by categoryId", async () => {
    await createTestTransaction(accountId, expenseCategoryId, { amount: 50 });
    await createTestTransaction(accountId, incomeCategoryId, {
      amount: 200,
      type: "INCOME",
    });
    const res = await GET(
      req(`/api/finance/transactions?categoryId=${expenseCategoryId}`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].categoryId).toBe(expenseCategoryId);
  });

  it("filters by type=INCOME", async () => {
    await createTestTransaction(accountId, expenseCategoryId, { amount: 50 });
    await createTestTransaction(accountId, incomeCategoryId, {
      amount: 200,
      type: "INCOME",
    });
    const res = await GET(req("/api/finance/transactions?type=INCOME"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("INCOME");
  });

  it("filters by type=EXPENSE", async () => {
    await createTestTransaction(accountId, expenseCategoryId, { amount: 50 });
    await createTestTransaction(accountId, expenseCategoryId, { amount: 75 });
    await createTestTransaction(accountId, incomeCategoryId, {
      amount: 200,
      type: "INCOME",
    });
    const res = await GET(req("/api/finance/transactions?type=EXPENSE"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data.every((t: { type: string }) => t.type === "EXPENSE")).toBe(true);
  });
});

describe("POST /api/finance/transactions", () => {
  it("creates INCOME transaction → 201, account balance increases", async () => {
    const res = await POST(
      jsonReq("/api/finance/transactions", "POST", {
        accountId,
        categoryId: incomeCategoryId,
        amount: 10000,
        type: "INCOME",
        description: "Salary",
        date: "2024-03-01",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.type).toBe("INCOME");
    expect(data.amount).toBe(10000);

    const account = await testDb.account.findUnique({ where: { id: accountId } });
    expect(account!.balance).toBe(10000);
  });

  it("creates EXPENSE transaction → 201, account balance decreases", async () => {
    await testDb.account.update({
      where: { id: accountId },
      data: { balance: 5000 },
    });
    const res = await POST(
      jsonReq("/api/finance/transactions", "POST", {
        accountId,
        categoryId: expenseCategoryId,
        amount: 300,
        type: "EXPENSE",
        description: "Groceries",
        date: "2024-03-05",
      })
    );
    expect(res.status).toBe(201);
    const account = await testDb.account.findUnique({ where: { id: accountId } });
    expect(account!.balance).toBe(4700);
  });

  it("fails without accountId → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/transactions", "POST", {
        categoryId: expenseCategoryId,
        amount: 100,
        type: "EXPENSE",
        date: "2024-03-01",
      })
    );
    expect(res.status).toBe(400);
  });

  it("fails without amount → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/transactions", "POST", {
        accountId,
        categoryId: expenseCategoryId,
        type: "EXPENSE",
        date: "2024-03-01",
      })
    );
    expect(res.status).toBe(400);
  });

  it("fails with negative amount → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/transactions", "POST", {
        accountId,
        categoryId: expenseCategoryId,
        amount: -50,
        type: "EXPENSE",
        date: "2024-03-01",
      })
    );
    expect(res.status).toBe(400);
  });

  it("fails with non-existent accountId → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/transactions", "POST", {
        accountId: "nonexistent-account-id",
        categoryId: expenseCategoryId,
        amount: 100,
        type: "EXPENSE",
        date: "2024-03-01",
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/finance/transactions/[id]", () => {
  it("updates amount → account balance recalculated correctly", async () => {
    // Start with EXPENSE of 200, account balance = -200
    const tx = await createTestTransaction(accountId, expenseCategoryId, {
      amount: 200,
      type: "EXPENSE",
    });
    const after = await testDb.account.findUnique({ where: { id: accountId } });
    expect(after!.balance).toBe(-200);

    // Update to EXPENSE of 500
    const res = await PUT(
      jsonReq(`/api/finance/transactions/${tx.id}`, "PUT", {
        accountId,
        categoryId: expenseCategoryId,
        amount: 500,
        type: "EXPENSE",
        description: "Updated",
        date: tx.date.toISOString(),
      }),
      { params: { id: tx.id } }
    );
    expect(res.status).toBe(200);

    const updated = await testDb.account.findUnique({ where: { id: accountId } });
    // old effect reverted (+200), new effect applied (-500) → net -500
    expect(updated!.balance).toBe(-500);
  });

  it("updates category → 200", async () => {
    const tx = await createTestTransaction(accountId, expenseCategoryId, {
      amount: 100,
    });
    const res = await PUT(
      jsonReq(`/api/finance/transactions/${tx.id}`, "PUT", {
        accountId,
        categoryId: incomeCategoryId,
        amount: 100,
        type: "EXPENSE",
        description: tx.description,
        date: tx.date.toISOString(),
      }),
      { params: { id: tx.id } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.categoryId).toBe(incomeCategoryId);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await PUT(
      jsonReq("/api/finance/transactions/nonexistent", "PUT", {
        accountId,
        categoryId: expenseCategoryId,
        amount: 100,
        type: "EXPENSE",
        description: "X",
        date: new Date().toISOString(),
      }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/finance/transactions/[id]", () => {
  it("deletes transaction → account balance recalculated correctly", async () => {
    const tx = await createTestTransaction(accountId, expenseCategoryId, {
      amount: 300,
      type: "EXPENSE",
    });
    const before = await testDb.account.findUnique({ where: { id: accountId } });
    expect(before!.balance).toBe(-300);

    const res = await DELETE(
      req(`/api/finance/transactions/${tx.id}`, { method: "DELETE" }),
      { params: { id: tx.id } }
    );
    expect(res.status).toBe(204);

    const after = await testDb.account.findUnique({ where: { id: accountId } });
    expect(after!.balance).toBe(0);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await DELETE(
      req("/api/finance/transactions/nonexistent", { method: "DELETE" }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});
