import { clearAll, testDb } from "../../helpers/db";
import { GET } from "@/app/api/net-worth/history/route";
import { subDays, subMonths, startOfDay } from "date-fns";

const BASE = "http://localhost:3000";

function req(path: string) {
  return new Request(`${BASE}${path}`);
}

beforeAll(async () => {
  await clearAll();
});

beforeEach(async () => {
  await testDb.netWorthSnapshot.deleteMany();
});

async function insertSnapshot(daysAgo: number, total: number) {
  const date = startOfDay(subDays(new Date(), daysAgo));
  date.setUTCHours(0, 0, 0, 0);
  return testDb.netWorthSnapshot.create({
    data: { date, cashTotal: total * 0.6, investmentsTotal: total * 0.4, total },
  });
}

describe("GET /api/net-worth/history", () => {
  it("returns empty array when no snapshots exist", async () => {
    const res = await GET(req("/api/net-worth/history?months=12"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns snapshots ordered by date ASC", async () => {
    await insertSnapshot(10, 300000);
    await insertSnapshot(5, 320000);
    await insertSnapshot(1, 350000);

    const res = await GET(req("/api/net-worth/history?months=3"));
    const data = await res.json();

    expect(data).toHaveLength(3);
    expect(data[0].total).toBe(300000);
    expect(data[1].total).toBe(320000);
    expect(data[2].total).toBe(350000);
  });

  it("filters by months parameter — excludes older snapshots", async () => {
    await insertSnapshot(400, 100000); // older than 12 months
    await insertSnapshot(30, 200000);  // within 3 months
    await insertSnapshot(5, 250000);   // within 3 months

    const res = await GET(req("/api/net-worth/history?months=3"));
    const data = await res.json();

    expect(data).toHaveLength(2);
    data.forEach((s: { total: number }) => expect(s.total).toBeGreaterThanOrEqual(200000));
  });

  it("defaults to 12 months when months param is absent", async () => {
    await insertSnapshot(400, 100000); // older than 12 months — excluded
    await insertSnapshot(200, 150000); // within 12 months — included
    await insertSnapshot(30, 200000);  // within 12 months — included

    const res = await GET(req("/api/net-worth/history"));
    const data = await res.json();

    expect(data).toHaveLength(2);
  });

  it("returns numbers (not Decimal strings) for financial fields", async () => {
    await insertSnapshot(1, 500000);

    const res = await GET(req("/api/net-worth/history?months=1"));
    const data = await res.json();

    expect(typeof data[0].cashTotal).toBe("number");
    expect(typeof data[0].investmentsTotal).toBe("number");
    expect(typeof data[0].total).toBe("number");
  });

  it("snapshot fields contain correct proportions", async () => {
    await insertSnapshot(1, 100000);

    const res = await GET(req("/api/net-worth/history?months=1"));
    const [snap] = await res.json();

    expect(snap.cashTotal).toBeCloseTo(60000, 1);
    expect(snap.investmentsTotal).toBeCloseTo(40000, 1);
    expect(snap.total).toBe(100000);
  });
});
