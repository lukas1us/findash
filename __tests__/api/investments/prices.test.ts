import { clearInvestments, testDb } from "../../helpers/db";
import { createTestAsset, createTestPrice } from "../../helpers/factories";
import { GET, POST, PATCH, DELETE } from "@/app/api/investments/prices/route";
import { POST as FETCH_POST } from "@/app/api/investments/prices/fetch/route";

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

const TEST_DATE = "2024-01-15T00:00:00.000Z";

let cryptoAssetId: string;

beforeAll(async () => {
  await clearInvestments();
  const asset = await createTestAsset({ name: "Bitcoin", ticker: "BTC", type: "CRYPTO" });
  cryptoAssetId = asset.id;
});

beforeEach(async () => {
  await testDb.assetPrice.deleteMany();
});

describe("GET /api/investments/prices", () => {
  it("returns empty array when no prices exist", async () => {
    const res = await GET(req("/api/investments/prices"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns latest price per asset", async () => {
    // Insert two prices for the same asset; should return only the latest
    await testDb.assetPrice.create({
      data: { assetId: cryptoAssetId, price: 1000000, source: "MANUAL" },
    });
    // Small delay to ensure different fetchedAt timestamps
    await new Promise((r) => setTimeout(r, 10));
    await testDb.assetPrice.create({
      data: { assetId: cryptoAssetId, price: 1500000, source: "MANUAL" },
    });

    const res = await GET(req("/api/investments/prices"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].price).toBe(1500000);
    expect(data[0].asset).toBeDefined();
  });

  it("rejects invalid limit → 400", async () => {
    const res = await GET(req("/api/investments/prices?limit=abc"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/investments/prices", () => {
  it("creates manual price entry (source=MANUAL) → 201", async () => {
    const res = await POST(
      jsonReq("/api/investments/prices", "POST", {
        assetId: cryptoAssetId,
        price: 1600000,
        date: TEST_DATE,
        source: "MANUAL",
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toMatchObject({
      id: expect.any(String),
      assetId: cryptoAssetId,
      price: 1600000,
      source: "MANUAL",
    });
    expect(data.asset).toBeDefined();
  });

  it("defaults source to MANUAL when not provided", async () => {
    const res = await POST(
      jsonReq("/api/investments/prices", "POST", {
        assetId: cryptoAssetId,
        price: 1700000,
        date: TEST_DATE,
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.source).toBe("MANUAL");
  });

  it("fails without assetId → 400", async () => {
    const res = await POST(
      jsonReq("/api/investments/prices", "POST", { price: 1000000, date: TEST_DATE })
    );
    expect(res.status).toBe(400);
  });

  it("fails without price → 400 with field: price", async () => {
    const res = await POST(
      jsonReq("/api/investments/prices", "POST", { assetId: cryptoAssetId, date: TEST_DATE })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.field).toBe("price");
  });

  it("fails with negative price → 400 with field: price", async () => {
    const res = await POST(
      jsonReq("/api/investments/prices", "POST", {
        assetId: cryptoAssetId,
        price: -100,
        date: TEST_DATE,
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.field).toBe("price");
  });

  it("fails with invalid date format → 400 with field: date", async () => {
    const res = await POST(
      jsonReq("/api/investments/prices", "POST", {
        assetId: cryptoAssetId,
        price: 1000000,
        date: "not-a-date",
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.field).toBe("date");
  });
});

describe("PATCH /api/investments/prices", () => {
  it("updates price by id → 200", async () => {
    const created = await testDb.assetPrice.create({
      data: { assetId: cryptoAssetId, price: 1000000, source: "MANUAL" },
    });

    const res = await PATCH(
      jsonReq("/api/investments/prices", "PATCH", { id: created.id, price: 2000000 })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.price).toBe(2000000);
  });

  it("fails without id → 400 with field: id", async () => {
    const res = await PATCH(
      jsonReq("/api/investments/prices", "PATCH", { price: 1000000 })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.field).toBe("id");
  });
});

describe("DELETE /api/investments/prices", () => {
  it("deletes price by id → 200", async () => {
    const created = await testDb.assetPrice.create({
      data: { assetId: cryptoAssetId, price: 1000000, source: "MANUAL" },
    });

    const res = await DELETE(req(`/api/investments/prices?id=${created.id}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("fails without id → 400", async () => {
    const res = await DELETE(req("/api/investments/prices"));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/investments/prices/fetch", () => {
  beforeEach(() => {
    // Mock global fetch to avoid hitting CoinGecko in tests
    jest.spyOn(global, "fetch").mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("coingecko")) {
        return {
          ok: true,
          json: async () => ({ bitcoin: { czk: 1800000 } }),
        } as Response;
      }
      throw new Error(`Unexpected fetch call: ${urlStr}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("triggers fetch for CRYPTO assets and returns updated prices", async () => {
    const res = await FETCH_POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(Array.isArray(data.results)).toBe(true);

    const btcResult = data.results.find(
      (r: { ticker: string }) => r.ticker.toUpperCase() === "BTC"
    );
    expect(btcResult).toBeDefined();
    expect(btcResult.price).toBe(1800000);
  });

  it("stores fetched prices with source=API", async () => {
    await FETCH_POST();
    const prices = await testDb.assetPrice.findMany({
      where: { assetId: cryptoAssetId, source: "API" },
    });
    expect(prices.length).toBeGreaterThan(0);
  });

  it("returns error info for unsupported tickers", async () => {
    // Create an asset with a ticker not in the CoinGecko map
    const unknownAsset = await createTestAsset({
      name: "Unknown Coin",
      ticker: "UNKNOWN",
      type: "CRYPTO",
    });

    const res = await FETCH_POST();
    const data = await res.json();
    const unknownResult = data.results.find(
      (r: { ticker: string }) => r.ticker === "UNKNOWN"
    );
    expect(unknownResult).toBeDefined();
    expect(unknownResult.price).toBeNull();
    expect(unknownResult.error).toBeDefined();

    // Cleanup
    await testDb.asset.delete({ where: { id: unknownAsset.id } });
  });
});
