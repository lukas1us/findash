import { clearInvestments, testDb } from "../../helpers/db";
import { createTestAsset, createTestPrice } from "../../helpers/factories";
import { GET, POST } from "@/app/api/investments/prices/route";
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
    const res = await GET();
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

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].price).toBe(1500000);
    expect(data[0].asset).toBeDefined();
  });
});

describe("POST /api/investments/prices", () => {
  it("creates manual price entry (source=MANUAL) → 201", async () => {
    const res = await POST(
      jsonReq("/api/investments/prices", "POST", {
        assetId: cryptoAssetId,
        price: 1600000,
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
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.source).toBe("MANUAL");
  });

  it("fails without assetId → 400", async () => {
    const res = await POST(
      jsonReq("/api/investments/prices", "POST", { price: 1000000 })
    );
    expect(res.status).toBe(400);
  });

  it("fails without price → 400", async () => {
    const res = await POST(
      jsonReq("/api/investments/prices", "POST", { assetId: cryptoAssetId })
    );
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
