import { clearAll, testDb } from "../../helpers/db";
import { createTestAccount, createTestAsset, createTestPurchase, createTestPrice } from "../../helpers/factories";
import { POST } from "@/app/api/net-worth/snapshot/route";
import { calculateCurrentNetWorth } from "@/lib/net-worth";

beforeAll(async () => {
  await clearAll();
});

beforeEach(async () => {
  await testDb.netWorthSnapshot.deleteMany();
  await clearAll();
});

// ─── calculateCurrentNetWorth ─────────────────────────────────────────────────

describe("calculateCurrentNetWorth()", () => {
  it("returns zeros when there are no accounts or assets", async () => {
    const result = await calculateCurrentNetWorth();
    expect(result.cashTotal).toBe(0);
    expect(result.investmentsTotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it("sums account balances into cashTotal", async () => {
    await createTestAccount({ name: "Běžný", balance: 50000 });
    await createTestAccount({ name: "Spořicí", balance: 120000 });

    const result = await calculateCurrentNetWorth();
    expect(result.cashTotal).toBe(170000);
  });

  it("calculates investmentsTotal from purchases × latest price", async () => {
    const asset = await createTestAsset({ name: "Bitcoin", ticker: "BTC" });
    await createTestPurchase(asset.id, { quantity: 0.5, pricePerUnit: 1000000 });
    await createTestPrice(asset.id, { price: 1800000 });

    const result = await calculateCurrentNetWorth();
    // 0.5 BTC × 1 800 000 CZK/BTC = 900 000
    expect(result.investmentsTotal).toBeCloseTo(900000, 1);
  });

  it("treats assets with no price as 0", async () => {
    const asset = await createTestAsset({ name: "NoPriceAsset", ticker: "NPA" });
    await createTestPurchase(asset.id, { quantity: 10, pricePerUnit: 500 });
    // no price record created

    const result = await calculateCurrentNetWorth();
    expect(result.investmentsTotal).toBe(0);
  });

  it("combines cash and investments into total", async () => {
    await createTestAccount({ name: "Účet", balance: 200000 });
    const asset = await createTestAsset({ name: "ETH", ticker: "ETH" });
    await createTestPurchase(asset.id, { quantity: 5, pricePerUnit: 60000 });
    await createTestPrice(asset.id, { price: 80000 });

    const result = await calculateCurrentNetWorth();
    expect(result.cashTotal).toBe(200000);
    expect(result.investmentsTotal).toBeCloseTo(400000, 1); // 5 × 80 000
    expect(result.total).toBeCloseTo(600000, 1);
  });
});

// ─── POST /api/net-worth/snapshot ────────────────────────────────────────────

describe("POST /api/net-worth/snapshot", () => {
  it("creates a new snapshot and returns 201", async () => {
    await createTestAccount({ name: "Fio", balance: 75000 });

    const res = await POST();
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.cashTotal).toBe(75000);
    expect(data.investmentsTotal).toBe(0);
    expect(data.total).toBe(75000);
  });

  it("persists the snapshot in the database", async () => {
    await createTestAccount({ name: "Účet", balance: 50000 });

    await POST();

    const saved = await testDb.netWorthSnapshot.findFirst();
    expect(saved).not.toBeNull();
    expect(Number(saved!.cashTotal)).toBe(50000);
  });

  it("returns numbers (not Decimal strings) in the response", async () => {
    await createTestAccount({ name: "Účet", balance: 10000 });

    const res = await POST();
    const data = await res.json();

    expect(typeof data.cashTotal).toBe("number");
    expect(typeof data.investmentsTotal).toBe("number");
    expect(typeof data.total).toBe("number");
  });

  it("upserts — calling POST twice on the same day overwrites, not duplicates", async () => {
    await createTestAccount({ name: "Účet", balance: 50000 });
    await POST();

    // Change balance and POST again
    const account = await testDb.account.findFirst();
    await testDb.account.update({ where: { id: account!.id }, data: { balance: 99000 } });
    const res2 = await POST();

    expect(res2.status).toBe(201);
    const data2 = await res2.json();
    expect(data2.cashTotal).toBe(99000);

    // Only one snapshot should exist
    const count = await testDb.netWorthSnapshot.count();
    expect(count).toBe(1);
  });
});
