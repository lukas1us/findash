import { clearFinance, testDb } from "../../helpers/db";
import { createTestCategory, createTestBudget } from "../../helpers/factories";
import { GET, POST } from "@/app/api/finance/budgets/route";
import { PUT, DELETE } from "@/app/api/finance/budgets/[id]/route";

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

let categoryId: string;

beforeAll(async () => {
  await clearFinance();
  const cat = await createTestCategory({ name: "Food", type: "EXPENSE" });
  categoryId = cat.id;
});

beforeEach(async () => {
  // Only clear budgets; keep the seeded category
  await testDb.budget.deleteMany();
});

describe("GET /api/finance/budgets", () => {
  it("returns budgets for all months when no filter", async () => {
    await createTestBudget(categoryId, { amount: 3000, month: "2024-01" });
    await createTestBudget(categoryId, { amount: 4000, month: "2024-02" });
    const res = await GET(req("/api/finance/budgets"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("filters by ?month=2024-03", async () => {
    await createTestBudget(categoryId, { amount: 3000, month: "2024-03" });
    await createTestBudget(categoryId, { amount: 4000, month: "2024-04" });
    const res = await GET(req("/api/finance/budgets?month=2024-03"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].amount).toBe(3000);
  });
});

describe("POST /api/finance/budgets", () => {
  it("creates budget with valid data → 201", async () => {
    const res = await POST(
      jsonReq("/api/finance/budgets", "POST", {
        categoryId,
        amount: 5000,
        month: "2024-05",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toMatchObject({
      id: expect.any(String),
      categoryId,
      amount: 5000,
    });
    expect(data.category).toBeDefined();
  });

  it("upserting same category+month updates the amount", async () => {
    await POST(
      jsonReq("/api/finance/budgets", "POST", {
        categoryId,
        amount: 3000,
        month: "2024-06",
      })
    );
    const res = await POST(
      jsonReq("/api/finance/budgets", "POST", {
        categoryId,
        amount: 6000,
        month: "2024-06",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.amount).toBe(6000);

    // Only one budget record for that month
    const all = await testDb.budget.findMany({ where: { categoryId } });
    expect(all).toHaveLength(1);
  });

  it("fails without categoryId → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/budgets", "POST", { amount: 1000, month: "2024-07" })
    );
    expect(res.status).toBe(400);
  });

  it("fails without amount → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/budgets", "POST", { categoryId, month: "2024-08" })
    );
    expect(res.status).toBe(400);
  });

  it("fails without month → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/budgets", "POST", { categoryId, amount: 1000 })
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/finance/budgets/[id]", () => {
  it("updates amount → 200", async () => {
    const budget = await createTestBudget(categoryId, {
      amount: 2000,
      month: "2024-09",
    });
    const res = await PUT(
      jsonReq(`/api/finance/budgets/${budget.id}`, "PUT", { amount: 9000 }),
      { params: { id: budget.id } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.amount).toBe(9000);
    expect(data.category).toBeDefined();
  });

  it("returns 404 for non-existent id", async () => {
    const res = await PUT(
      jsonReq("/api/finance/budgets/nonexistent", "PUT", { amount: 100 }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/finance/budgets/[id]", () => {
  it("deletes budget → 204", async () => {
    const budget = await createTestBudget(categoryId, {
      amount: 1000,
      month: "2024-10",
    });
    const res = await DELETE(
      req(`/api/finance/budgets/${budget.id}`, { method: "DELETE" }),
      { params: { id: budget.id } }
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await DELETE(
      req("/api/finance/budgets/nonexistent", { method: "DELETE" }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});
