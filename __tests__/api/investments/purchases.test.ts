import { clearInvestments } from "../../helpers/db";
import { createTestAsset, createTestPurchase } from "../../helpers/factories";
import { GET, POST } from "@/app/api/investments/purchases/route";
import { PUT, DELETE } from "@/app/api/investments/purchases/[id]/route";

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

let btcAssetId: string;

beforeAll(async () => {
  await clearInvestments();
  const asset = await createTestAsset({ name: "Bitcoin", ticker: "BTC", type: "CRYPTO" });
  btcAssetId = asset.id;
});

beforeEach(async () => {
  // Clear purchases only, keep seeded asset
  const { testDb } = await import("../../helpers/db");
  await testDb.purchase.deleteMany();
});

describe("GET /api/investments/purchases", () => {
  it("returns all purchases", async () => {
    await createTestPurchase(btcAssetId, { quantity: 0.5, pricePerUnit: 1000000 });
    await createTestPurchase(btcAssetId, { quantity: 1, pricePerUnit: 1200000 });
    const res = await GET(req("/api/investments/purchases"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].asset).toBeDefined();
  });

  it("filters by ?assetId=", async () => {
    const otherAsset = await createTestAsset({ name: "ETH", ticker: "ETH" });
    await createTestPurchase(btcAssetId, { quantity: 1 });
    await createTestPurchase(otherAsset.id, { quantity: 10 });

    const res = await GET(
      req(`/api/investments/purchases?assetId=${btcAssetId}`)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.every((p: { assetId: string }) => p.assetId === btcAssetId)).toBe(true);

    // Clean up
    const { testDb } = await import("../../helpers/db");
    await testDb.asset.delete({ where: { id: otherAsset.id } });
  });
});

describe("POST /api/investments/purchases", () => {
  it("creates purchase with quantity + pricePerUnit + date → 201", async () => {
    const res = await POST(
      jsonReq("/api/investments/purchases", "POST", {
        assetId: btcAssetId,
        quantity: 0.1,
        pricePerUnit: 1500000,
        date: "2024-01-15",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toMatchObject({
      id: expect.any(String),
      assetId: btcAssetId,
      quantity: 0.1,
      pricePerUnit: 1500000,
    });
    expect(data.asset).toBeDefined();
  });

  it("fails without assetId → 400", async () => {
    const res = await POST(
      jsonReq("/api/investments/purchases", "POST", {
        quantity: 1,
        pricePerUnit: 1000000,
        date: "2024-01-01",
      })
    );
    expect(res.status).toBe(400);
  });

  it("fails without quantity → 400", async () => {
    const res = await POST(
      jsonReq("/api/investments/purchases", "POST", {
        assetId: btcAssetId,
        pricePerUnit: 1000000,
        date: "2024-01-01",
      })
    );
    expect(res.status).toBe(400);
  });

  it("fails without pricePerUnit → 400", async () => {
    const res = await POST(
      jsonReq("/api/investments/purchases", "POST", {
        assetId: btcAssetId,
        quantity: 1,
        date: "2024-01-01",
      })
    );
    expect(res.status).toBe(400);
  });

  it("fails with non-existent assetId → 400", async () => {
    const res = await POST(
      jsonReq("/api/investments/purchases", "POST", {
        assetId: "nonexistent-asset-id",
        quantity: 1,
        pricePerUnit: 1000000,
        date: "2024-01-01",
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/investments/purchases/[id]", () => {
  it("updates quantity and pricePerUnit → 200", async () => {
    const purchase = await createTestPurchase(btcAssetId, {
      quantity: 1,
      pricePerUnit: 1000000,
    });
    const res = await PUT(
      jsonReq(`/api/investments/purchases/${purchase.id}`, "PUT", {
        assetId: btcAssetId,
        quantity: 2,
        pricePerUnit: 1200000,
        date: purchase.date.toISOString(),
        fees: 0,
      }),
      { params: { id: purchase.id } }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.quantity).toBe(2);
    expect(data.pricePerUnit).toBe(1200000);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await PUT(
      jsonReq("/api/investments/purchases/nonexistent", "PUT", {
        assetId: btcAssetId,
        quantity: 1,
        pricePerUnit: 1000000,
        date: new Date().toISOString(),
        fees: 0,
      }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/investments/purchases/[id]", () => {
  it("deletes purchase → 204", async () => {
    const purchase = await createTestPurchase(btcAssetId);
    const res = await DELETE(
      req(`/api/investments/purchases/${purchase.id}`, { method: "DELETE" }),
      { params: { id: purchase.id } }
    );
    expect(res.status).toBe(204);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await DELETE(
      req("/api/investments/purchases/nonexistent", { method: "DELETE" }),
      { params: { id: "nonexistent" } }
    );
    expect(res.status).toBe(404);
  });
});
