import { clearInvestments } from "../../helpers/db";
import { createTestAsset } from "../../helpers/factories";
import { GET, POST } from "@/app/api/investments/assets/route";
import { PUT, DELETE } from "@/app/api/investments/assets/[id]/route";

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

describe("GET /api/investments/assets", () => {
  beforeEach(async () => {
    await clearInvestments();
  });

  it("returns all assets with expected fields", async () => {
    await createTestAsset({ name: "Bitcoin", ticker: "BTC", type: "CRYPTO" });
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      id: expect.any(String),
      name: "Bitcoin",
      ticker: "BTC",
      type: "CRYPTO",
      currency: "CZK",
    });
    // Includes related data
    expect(Array.isArray(data[0].purchases)).toBe(true);
    expect(Array.isArray(data[0].prices)).toBe(true);
  });
});

describe("POST /api/investments/assets", () => {
  beforeEach(async () => {
    await clearInvestments();
  });

  it("creates CRYPTO asset → 201", async () => {
    const res = await POST(
      jsonReq("/api/investments/assets", "POST", {
        name: "Bitcoin",
        ticker: "BTC",
        type: "CRYPTO",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toMatchObject({ name: "Bitcoin", ticker: "BTC", type: "CRYPTO" });
  });

  it("creates REAL_ESTATE asset → 201", async () => {
    const res = await POST(
      jsonReq("/api/investments/assets", "POST", {
        name: "Apartment Prague",
        ticker: "APT",
        type: "REAL_ESTATE",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.type).toBe("REAL_ESTATE");
  });

  it("creates GOLD_SILVER asset → 201", async () => {
    const res = await POST(
      jsonReq("/api/investments/assets", "POST", {
        name: "Gold Bar",
        ticker: "XAU",
        type: "GOLD_SILVER",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.type).toBe("GOLD_SILVER");
  });

  it("fails with invalid type → 400", async () => {
    const res = await POST(
      jsonReq("/api/investments/assets", "POST", {
        name: "Asset",
        ticker: "X",
        type: "STOCKS",
      })
    );
    expect(res.status).toBe(400);
  });

  it("fails without name → 400", async () => {
    const res = await POST(
      jsonReq("/api/investments/assets", "POST", { ticker: "BTC", type: "CRYPTO" })
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/investments/assets/[id]", () => {
  beforeEach(async () => {
    await clearInvestments();
  });

  it("updates name/ticker → 200", async () => {
    const asset = await createTestAsset({ name: "Old Name", ticker: "OLD" });
    const res = await PUT(
      jsonReq(`/api/investments/assets/${asset.id}`, "PUT", {
        name: "New Name",
        ticker: "NEW",
        type: "CRYPTO",
        currency: "CZK",
      }),
      { params: { id: asset.id } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("New Name");
    expect(data.ticker).toBe("NEW");
  });

  it("returns 404 for non-existent id", async () => {
    const res = await PUT(
      jsonReq("/api/investments/assets/nonexistent", "PUT", {
        name: "X",
        ticker: "X",
        type: "CRYPTO",
        currency: "CZK",
      }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/investments/assets/[id]", () => {
  beforeEach(async () => {
    await clearInvestments();
  });

  it("deletes asset → 204", async () => {
    const asset = await createTestAsset();
    const res = await DELETE(
      req(`/api/investments/assets/${asset.id}`, { method: "DELETE" }),
      { params: { id: asset.id } }
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await DELETE(
      req("/api/investments/assets/nonexistent", { method: "DELETE" }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});
