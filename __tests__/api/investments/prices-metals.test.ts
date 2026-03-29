import { clearInvestments, testDb } from "../../helpers/db";
import { createTestAsset } from "../../helpers/factories";
import { POST } from "@/app/api/investments/prices/metals/route";

const MOCK_USD_CZK = 23.5;
const MOCK_XAU_USD = 3100.0;
const MOCK_XAG_USD = 32.5;

function mockFetch(url: string): Promise<Response> {
  const urlStr = String(url);
  if (urlStr.includes("goldapi.io/api/XAU")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ price: MOCK_XAU_USD, timestamp: 1700000000 }),
      text: async () => "",
    } as Response);
  }
  if (urlStr.includes("goldapi.io/api/XAG")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ price: MOCK_XAG_USD, timestamp: 1700000000 }),
      text: async () => "",
    } as Response);
  }
  if (urlStr.includes("frankfurter.app")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ rates: { CZK: MOCK_USD_CZK } }),
    } as Response);
  }
  throw new Error(`Unexpected fetch: ${urlStr}`);
}

beforeAll(async () => {
  await clearInvestments();
});

beforeEach(() => {
  jest.spyOn(global, "fetch").mockImplementation(mockFetch);
});

afterEach(async () => {
  jest.restoreAllMocks();
  await testDb.assetPrice.deleteMany();
  await testDb.asset.deleteMany({ where: { type: "GOLD_SILVER" } });
});

describe("POST /api/investments/prices/metals", () => {
  it("saves CZK price for XAU asset and returns updated list", async () => {
    await createTestAsset({ name: "Zlato", ticker: "XAU", type: "GOLD_SILVER" });

    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.updated).toEqual(["Zlato"]);
    expect(data.pricesUsd.XAU).toBe(MOCK_XAU_USD);

    const saved = await testDb.assetPrice.findFirst({ where: { source: "API" } });
    expect(saved).not.toBeNull();
    expect(saved!.price).toBeCloseTo(MOCK_XAU_USD * MOCK_USD_CZK, 1);
  });

  it("saves prices for both XAU and XAG assets", async () => {
    await createTestAsset({ name: "Zlato", ticker: "XAU", type: "GOLD_SILVER" });
    await createTestAsset({ name: "Stříbro", ticker: "XAG", type: "GOLD_SILVER" });

    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.updated).toHaveLength(2);
    expect(data.updated).toContain("Zlato");
    expect(data.updated).toContain("Stříbro");
    expect(data.pricesUsd.XAU).toBe(MOCK_XAU_USD);
    expect(data.pricesUsd.XAG).toBe(MOCK_XAG_USD);
  });

  it("returns empty updated list when no GOLD_SILVER assets exist", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.updated).toEqual([]);
    expect(data.error).toBeDefined();
  });

  it("skips GOLD_SILVER assets with unsupported tickers", async () => {
    await createTestAsset({ name: "Platina", ticker: "XPT", type: "GOLD_SILVER" });

    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.updated).toEqual([]);
    expect(data.error).toBeDefined();
  });

  it("returns 500 when GoldAPI responds with error", async () => {
    await createTestAsset({ name: "Zlato", ticker: "XAU", type: "GOLD_SILVER" });

    jest.restoreAllMocks();
    jest.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("goldapi.io")) {
        return { ok: false, status: 429, text: async () => "rate limit" } as Response;
      }
      return mockFetch(String(url));
    });

    const res = await POST();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toMatch(/429/);
  });
});
