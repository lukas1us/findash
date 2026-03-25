import { clearFinance } from "../../helpers/db";
import { createTestAccount } from "../../helpers/factories";
import { GET, POST } from "@/app/api/finance/accounts/route";
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from "@/app/api/finance/accounts/[id]/route";

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

describe("GET /api/finance/accounts", () => {
  beforeEach(async () => {
    await clearFinance();
  });

  it("returns empty array when no accounts exist", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns list of accounts with correct fields", async () => {
    await createTestAccount({ name: "Savings", type: "SAVINGS", balance: 1000 });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: expect.any(String),
      name: "Savings",
      type: "SAVINGS",
      currency: "CZK",
      balance: 1000,
    });
  });
});

describe("POST /api/finance/accounts", () => {
  beforeEach(async () => {
    await clearFinance();
  });

  it("creates account with valid data → 201 + created object", async () => {
    const res = await POST(
      jsonReq("/api/finance/accounts", "POST", {
        name: "My Checking",
        type: "CHECKING",
        currency: "CZK",
        balance: 5000,
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toMatchObject({
      id: expect.any(String),
      name: "My Checking",
      type: "CHECKING",
      currency: "CZK",
      balance: 5000,
    });
  });

  it("fails without required field name → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/accounts", "POST", { type: "CHECKING" })
    );
    expect(res.status).toBe(400);
  });

  it("fails without required field type → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/accounts", "POST", { name: "Acct" })
    );
    expect(res.status).toBe(400);
  });

  it("fails with invalid type value → 400", async () => {
    const res = await POST(
      jsonReq("/api/finance/accounts", "POST", {
        name: "Acct",
        type: "INVALID",
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/finance/accounts/[id]", () => {
  beforeEach(async () => {
    await clearFinance();
  });

  it("returns account by id", async () => {
    const account = await createTestAccount({ name: "My Account" });
    const res = await GET_BY_ID(req(`/api/finance/accounts/${account.id}`), {
      params: { id: account.id },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(account.id);
    expect(data.name).toBe("My Account");
  });

  it("returns 404 for non-existent id", async () => {
    const res = await GET_BY_ID(
      req("/api/finance/accounts/nonexistent-id"),
      { params: { id: "nonexistent-id" } }
    );
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/finance/accounts/[id]", () => {
  beforeEach(async () => {
    await clearFinance();
  });

  it("updates account and returns updated object", async () => {
    const account = await createTestAccount({ name: "Old Name", type: "CHECKING" });
    const res = await PUT(
      jsonReq(`/api/finance/accounts/${account.id}`, "PUT", {
        name: "New Name",
        type: "SAVINGS",
        currency: "CZK",
        balance: 0,
      }),
      { params: { id: account.id } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("New Name");
    expect(data.type).toBe("SAVINGS");
  });

  it("returns 404 for non-existent id", async () => {
    const res = await PUT(
      jsonReq("/api/finance/accounts/nonexistent", "PUT", {
        name: "X",
        type: "CHECKING",
        currency: "CZK",
        balance: 0,
      }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/finance/accounts/[id]", () => {
  beforeEach(async () => {
    await clearFinance();
  });

  it("deletes account → 204", async () => {
    const account = await createTestAccount();
    const res = await DELETE(
      req(`/api/finance/accounts/${account.id}`, { method: "DELETE" }),
      { params: { id: account.id } }
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await DELETE(
      req("/api/finance/accounts/nonexistent", { method: "DELETE" }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});
