import { clearInvestments } from "../../helpers/db";
import {
  createTestAsset,
  createTestPurchase,
  createTestPrice,
} from "../../helpers/factories";
import { GET } from "@/app/api/investments/stats/route";

const BASE = "http://localhost:3000";

function req(path: string) {
  return new Request(`${BASE}${path}`);
}

let assetId: string;

// Seed: 1 BTC asset, 2 purchases at different prices, 1 current price
// Purchase 1: 0.5 BTC @ 1,000,000 CZK  → cost = 500,000
// Purchase 2: 0.5 BTC @ 1,200,000 CZK  → cost = 600,000
// Total: 1 BTC, totalCostBasis = 1,100,000
// Current price: 1,500,000 → totalValue = 1,500,000
// PnL: 400,000 CZK  ≈ 36.36%
beforeAll(async () => {
  await clearInvestments();
  const asset = await createTestAsset({ name: "Bitcoin", ticker: "BTC", type: "CRYPTO" });
  assetId = asset.id;

  await createTestPurchase(assetId, {
    quantity: 0.5,
    pricePerUnit: 1000000,
    fees: 0,
    date: new Date("2024-01-01"),
  });
  await createTestPurchase(assetId, {
    quantity: 0.5,
    pricePerUnit: 1200000,
    fees: 0,
    date: new Date("2024-02-01"),
  });
  await createTestPrice(assetId, { price: 1500000 });
});

describe("GET /api/investments/stats", () => {
  it("returns totalValue (quantity * currentPrice)", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    // 1 BTC × 1,500,000 = 1,500,000
    expect(data.totalValue).toBeCloseTo(1500000, 0);
  });

  it("returns totalCostBasis (sum of quantity * pricePerUnit across purchases)", async () => {
    const res = await GET();
    const data = await res.json();
    // 0.5 × 1,000,000 + 0.5 × 1,200,000 = 1,100,000
    expect(data.totalCostBasis).toBeCloseTo(1100000, 0);
  });

  it("returns totalPnlCzk (totalValue - totalCostBasis)", async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.totalPnlCzk).toBeCloseTo(400000, 0);
  });

  it("returns totalPnlPct ((pnl / costBasis) * 100)", async () => {
    const res = await GET();
    const data = await res.json();
    // 400,000 / 1,100,000 * 100 ≈ 36.36%
    expect(data.totalPnlPct).toBeCloseTo(36.36, 1);
  });

  it("all portfolio values are numbers", async () => {
    const res = await GET();
    const data = await res.json();
    expect(typeof data.totalValue).toBe("number");
    expect(typeof data.totalCostBasis).toBe("number");
    expect(typeof data.totalPnlCzk).toBe("number");
    expect(typeof data.totalPnlPct).toBe("number");
  });

  it("returns per-asset stats array", async () => {
    const res = await GET();
    const data = await res.json();
    expect(Array.isArray(data.assets)).toBe(true);
    expect(data.assets).toHaveLength(1);
    const btc = data.assets[0];
    expect(btc).toMatchObject({
      id: assetId,
      name: "Bitcoin",
      ticker: "BTC",
      type: "CRYPTO",
      totalQty: expect.any(Number),
      avgBuyPrice: expect.any(Number),
      currentPrice: expect.any(Number),
      currentValue: expect.any(Number),
      totalCost: expect.any(Number),
      pnlCzk: expect.any(Number),
      pnlPct: expect.any(Number),
    });
  });

  it("returns allocationPie array", async () => {
    const res = await GET();
    const data = await res.json();
    expect(Array.isArray(data.allocationPie)).toBe(true);
    expect(data.allocationPie[0]).toMatchObject({
      name: expect.any(String),
      value: expect.any(Number),
      color: expect.any(String),
    });
  });
});
