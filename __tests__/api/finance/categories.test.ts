import { clearFinance } from "../../helpers/db";
import { createTestCategory } from "../../helpers/factories";
import { GET, POST } from "@/app/api/finance/categories/route";
import { PUT, DELETE } from "@/app/api/finance/categories/[id]/route";

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

describe("GET /api/finance/categories", () => {
  beforeEach(async () => {
    await clearFinance();
  });

  it("returns all categories", async () => {
    await createTestCategory({ name: "Salary", type: "INCOME" });
    await createTestCategory({ name: "Food", type: "EXPENSE" });
    const res = await GET(req("/api/finance/categories"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("returns categories filtered by type=INCOME", async () => {
    await createTestCategory({ name: "Salary", type: "INCOME" });
    await createTestCategory({ name: "Food", type: "EXPENSE" });
    const res = await GET(req("/api/finance/categories?type=INCOME"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("INCOME");
  });

  it("returns categories filtered by type=EXPENSE", async () => {
    await createTestCategory({ name: "Salary", type: "INCOME" });
    await createTestCategory({ name: "Food", type: "EXPENSE" });
    await createTestCategory({ name: "Rent", type: "EXPENSE" });
    const res = await GET(req("/api/finance/categories?type=EXPENSE"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data.every((c: { type: string }) => c.type === "EXPENSE")).toBe(true);
  });
});

describe("POST /api/finance/categories", () => {
  beforeEach(async () => {
    await clearFinance();
  });

  it("creates with valid data (name, type, color) → 201", async () => {
    const res = await POST(
      jsonReq("/api/finance/categories", "POST", {
        name: "Groceries",
        type: "EXPENSE",
        color: "#ff0000",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toMatchObject({
      id: expect.any(String),
      name: "Groceries",
      type: "EXPENSE",
      color: "#ff0000",
    });
  });

  it("uses default color when not provided", async () => {
    const res = await POST(
      jsonReq("/api/finance/categories", "POST", { name: "Food", type: "EXPENSE" })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.color).toBe("#6366f1");
  });

  it("fails without name → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/categories", "POST", { type: "EXPENSE" })
    );
    expect(res.status).toBe(400);
  });

  it("fails with invalid type → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/categories", "POST", {
        name: "Test",
        type: "INVALID",
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/finance/categories/[id]", () => {
  beforeEach(async () => {
    await clearFinance();
  });

  it("updates name and color → returns updated object", async () => {
    const cat = await createTestCategory({ name: "Old Name", color: "#000000" });
    const res = await PUT(
      jsonReq(`/api/finance/categories/${cat.id}`, "PUT", {
        name: "New Name",
        type: "EXPENSE",
        color: "#ffffff",
        icon: "tag",
      }),
      { params: { id: cat.id } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("New Name");
    expect(data.color).toBe("#ffffff");
  });

  it("returns 404 for non-existent id", async () => {
    const res = await PUT(
      jsonReq("/api/finance/categories/nonexistent", "PUT", {
        name: "X",
        type: "EXPENSE",
        color: "#000",
        icon: "tag",
      }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/finance/categories/[id]", () => {
  beforeEach(async () => {
    await clearFinance();
  });

  it("deletes category → 204", async () => {
    const cat = await createTestCategory();
    const res = await DELETE(
      req(`/api/finance/categories/${cat.id}`, { method: "DELETE" }),
      { params: { id: cat.id } }
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await DELETE(
      req("/api/finance/categories/nonexistent", { method: "DELETE" }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});
