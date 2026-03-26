import { clearInvestments } from "../../helpers/db";
import { createTestAsset, createTestCryptoTransaction } from "../../helpers/factories";
import {
  detectCryptoFormat,
  parseBinance,
  parseCoinmateOrders,
  parseCoinmateHistory,
  parseCryptoComCrypto,
} from "@/lib/crypto-parsers";
import { POST as previewPOST } from "@/app/api/investments/import/preview/route";
import { POST as confirmPOST } from "@/app/api/investments/import/confirm/route";

const BASE = "http://localhost:3000";

// ─── Format detection ─────────────────────────────────────────────────────────

describe("detectCryptoFormat", () => {
  it("detects binance", () => {
    const csv = `User_ID,UTC_Time,Account,Operation,Coin,Change,Remark\n123,2023-01-01 12:00:00,Spot,Buy,BTC,0.01,`;
    expect(detectCryptoFormat(csv)).toBe("binance");
  });

  it("detects coinmate_orders", () => {
    const csv = `ORDER ID,DATE,TYPE,AMOUNT,PRICE,STOP PRICE,ORIGINAL AMOUNT,REMAINING AMOUNT,EXECUTED AMOUNT,FEE,FEE CURRENCY,STATUS,PAIR,LAST UPDATE TIME\n1,2023-01-01,BUY,1000,500000,,1000,0,1000,5,CZK,FILLED,BTC_CZK,2023-01-01`;
    expect(detectCryptoFormat(csv)).toBe("coinmate_orders");
  });

  it("detects coinmate_history", () => {
    const csv = `ID;Datum;Typ;Částka měny;Měna;Status;Fee\n1;01.01.2023;BUY;1000;CZK;COMPLETED;0`;
    expect(detectCryptoFormat(csv)).toBe("coinmate_history");
  });

  it("detects cryptocom", () => {
    const csv = `Timestamp (UTC),Transaction Description,Currency,Amount,To Currency,To Amount,Native Currency,Native Amount,Native Amount (in USD),Transaction Kind\n2023-01-01,Buy,BTC,0.01,,,,25000,,crypto_purchase`;
    expect(detectCryptoFormat(csv)).toBe("cryptocom");
  });

  it("returns unknown for unrecognized CSV", () => {
    const csv = `col1,col2,col3\nval1,val2,val3`;
    expect(detectCryptoFormat(csv)).toBe("unknown");
  });
});

// ─── Binance parser ───────────────────────────────────────────────────────────

describe("parseBinance", () => {
  const CSV = `User_ID,UTC_Time,Account,Operation,Coin,Change,Remark
123,2023-06-01 10:00:00,Spot,Buy,BTC,0.01,
123,2023-06-01 10:00:00,Spot,Buy,CZK,-6200,
123,2023-06-05 14:00:00,Spot,Sell,BTC,-0.005,
123,2023-06-05 14:00:00,Spot,Sell,CZK,3000,
123,2023-06-10 09:00:00,Spot,Staking Rewards,ETH,0.05,`;

  it("parses rows and skips fiat", () => {
    const rows = parseBinance(CSV);
    const nonError = rows.filter((r) => !r.parseError);
    // BTC Buy, BTC Sell, ETH Staking Reward → 3 rows (CZK fiat rows skipped)
    expect(nonError).toHaveLength(3);
  });

  it("maps Buy → BUY with positive quantity", () => {
    const rows = parseBinance(CSV).filter((r) => !r.parseError);
    const buy = rows.find((r) => r.type === "BUY");
    expect(buy).toBeDefined();
    expect(buy!.quantity).toBeGreaterThan(0);
    expect(buy!.ticker).toBe("BTC");
  });

  it("maps Sell → SELL with negative quantity", () => {
    const rows = parseBinance(CSV).filter((r) => !r.parseError);
    const sell = rows.find((r) => r.type === "SELL");
    expect(sell).toBeDefined();
    expect(sell!.quantity).toBeLessThan(0);
  });

  it("maps Staking Rewards → REWARD", () => {
    const rows = parseBinance(CSV).filter((r) => !r.parseError);
    const reward = rows.find((r) => r.type === "REWARD");
    expect(reward).toBeDefined();
    expect(reward!.ticker).toBe("ETH");
  });

  it("sets sourceId in format UTC_Time|Coin|Change", () => {
    const rows = parseBinance(CSV).filter((r) => !r.parseError);
    expect(rows[0].sourceId).toMatch(/\|/);
  });
});

// ─── Coinmate Orders parser ───────────────────────────────────────────────────

describe("parseCoinmateOrders", () => {
  // Columns the parser actually reads: ORDER ID, DATE OPENED, TYPE, PAIR, ORIG. SIZE, PRICE, ORDER TOTAL, DATE FILLED, STATUS
  const CSV = `ORDER ID,DATE OPENED,TYPE,PAIR,ORIG. SIZE,PRICE,ORDER TOTAL,DATE FILLED,STATUS
1001,2023-01-15,BUY,BTC_CZK,0.01,600000,6000,2023-01-15,FILLED
1002,2023-02-20,SELL,BTC_CZK,0.005,650000,3250,2023-02-20,FILLED
1003,2023-03-01,BUY,ETH_CZK,1,30000,30000,2023-03-01,CANCELLED`;

  it("parses FILLED orders only", () => {
    const rows = parseCoinmateOrders(CSV).filter((r) => !r.parseError);
    expect(rows).toHaveLength(2);
  });

  it("extracts ticker from PAIR field", () => {
    const rows = parseCoinmateOrders(CSV).filter((r) => !r.parseError);
    expect(rows[0].ticker).toBe("BTC");
  });

  it("maps BUY with positive quantity", () => {
    const rows = parseCoinmateOrders(CSV).filter((r) => !r.parseError);
    const buy = rows.find((r) => r.type === "BUY");
    expect(buy!.quantity).toBeGreaterThan(0);
  });

  it("maps SELL with negative quantity", () => {
    const rows = parseCoinmateOrders(CSV).filter((r) => !r.parseError);
    const sell = rows.find((r) => r.type === "SELL");
    expect(sell!.quantity).toBeLessThan(0);
  });

  it("uses ORDER ID as sourceId", () => {
    const rows = parseCoinmateOrders(CSV).filter((r) => !r.parseError);
    expect(rows[0].sourceId).toBe("1001");
  });
});

// ─── Coinmate History parser ──────────────────────────────────────────────────

describe("parseCoinmateHistory", () => {
  // Columns the parser reads: ID;Datum;Účet;Typ;Částka;Částka měny;Cena;Cena měny;Poplatek;Poplatek měny;Celkem;Celkem měny;Popisek;Status
  const CSV = `ID;Datum;Účet;Typ;Částka;Částka měny;Cena;Cena měny;Poplatek;Poplatek měny;Celkem;Celkem měny;Popisek;Status
501;01.03.2023;Spot;BUY;0.01;BTC;600000;CZK;50;CZK;6050;CZK;;COMPLETED
502;05.03.2023;Spot;SELL;0.005;BTC;650000;CZK;25;CZK;3225;CZK;;OK
503;10.03.2023;Spot;DEPOSIT;1;ETH;;;;;0;CZK;;COMPLETED`;

  it("parses COMPLETED/OK rows", () => {
    const rows = parseCoinmateHistory(CSV).filter((r) => !r.parseError);
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("maps BUY → positive quantity", () => {
    const rows = parseCoinmateHistory(CSV).filter((r) => !r.parseError);
    const buy = rows.find((r) => r.type === "BUY");
    expect(buy).toBeDefined();
    expect(buy!.quantity).toBeGreaterThan(0);
  });

  it("uses ID as sourceId", () => {
    const rows = parseCoinmateHistory(CSV).filter((r) => !r.parseError);
    expect(rows[0].sourceId).toBe("501");
  });
});

// ─── Crypto.com parser ────────────────────────────────────────────────────────

describe("parseCryptoComCrypto", () => {
  const CSV = `Timestamp (UTC),Transaction Description,Currency,Amount,To Currency,To Amount,Native Currency,Native Amount,Native Amount (in USD),Transaction Kind
2023-01-10 10:00:00,Buy BTC,BTC,0.01,,,,25000,,crypto_purchase
2023-02-15 12:00:00,Sell BTC,BTC,-0.005,,,,12000,,crypto_withdrawal
2023-03-01 09:00:00,Staking Reward,CRO,100,,,,500,,mco_stake_reward`;

  it("maps crypto_purchase → BUY", () => {
    const rows = parseCryptoComCrypto(CSV).filter((r) => !r.parseError);
    const buy = rows.find((r) => r.type === "BUY");
    expect(buy).toBeDefined();
    expect(buy!.ticker).toBe("BTC");
  });

  it("maps staking_reward_withdrawal → REWARD", () => {
    const rows = parseCryptoComCrypto(CSV).filter((r) => !r.parseError);
    const reward = rows.find((r) => r.type === "REWARD");
    expect(reward).toBeDefined();
    expect(reward!.ticker).toBe("CRO");
  });
});

// ─── Import preview API ───────────────────────────────────────────────────────

describe("POST /api/investments/import/preview", () => {
  beforeEach(() => clearInvestments());

  it("returns error for unrecognized file", async () => {
    const formData = new FormData();
    formData.append("files", new File(["col1,col2\nval1,val2"], "unknown.csv", { type: "text/csv" }));
    const res = await previewPOST(new Request(`${BASE}/api/investments/import/preview`, { method: "POST", body: formData }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].format).toBe("unknown");
    expect(data[0].warnings).toContain("Nerozpoznaný formát CSV");
  });

  it("returns 400 when no files provided", async () => {
    const formData = new FormData();
    const res = await previewPOST(new Request(`${BASE}/api/investments/import/preview`, { method: "POST", body: formData }));
    expect(res.status).toBe(400);
  });
});

// ─── Import confirm API ───────────────────────────────────────────────────────

describe("POST /api/investments/import/confirm", () => {
  beforeEach(() => clearInvestments());

  async function confirm(rows: unknown[], assetMapping: Record<string, string> = {}) {
    return confirmPOST(
      new Request(`${BASE}/api/investments/import/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, assetMapping }),
      })
    );
  }

  it("auto-creates asset and imports transaction", async () => {
    const res = await confirm([{
      rowIndex: 0,
      date: "2023-06-01",
      type: "BUY",
      ticker: "BTC",
      quantity: 0.01,
      pricePerUnit: 620000,
      totalCZK: 6200,
      source: "BINANCE",
      sourceId: "test-source-id-1",
    }]);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary["BINANCE"].imported).toBe(1);
    expect(data.summary["BINANCE"].skipped).toBe(0);
  });

  it("skips duplicate sourceId silently", async () => {
    const asset = await createTestAsset({ ticker: "ETH" });
    await createTestCryptoTransaction(asset.id, { source: "BINANCE", sourceId: "dup-id-1" });

    const res = await confirm([{
      rowIndex: 0,
      date: "2023-06-01",
      type: "BUY",
      ticker: "ETH",
      quantity: 1,
      source: "BINANCE",
      sourceId: "dup-id-1",
    }], { ETH: asset.id });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary["BINANCE"].skipped).toBe(1);
    expect(data.summary["BINANCE"].imported).toBe(0);
  });

  it("skips rows with parseError", async () => {
    const res = await confirm([{
      rowIndex: 0,
      date: "",
      type: "BUY",
      ticker: "BTC",
      quantity: 0,
      source: "BINANCE",
      parseError: "Neznámá operace",
    }]);
    expect(res.status).toBe(200);
    const data = await res.json();
    // parseError rows are silently skipped, summary won't have BINANCE at all
    expect(Object.keys(data.summary)).toHaveLength(0);
  });
});

// ─── Quantity calculation ─────────────────────────────────────────────────────

describe("quantity after mixed BUY/SELL", () => {
  beforeEach(() => clearInvestments());

  it("net quantity = BUY - SELL amounts", async () => {
    const asset = await createTestAsset({ ticker: "SOL" });
    await createTestCryptoTransaction(asset.id, { type: "BUY",  quantity:  10, source: "test", sourceId: "q1" });
    await createTestCryptoTransaction(asset.id, { type: "BUY",  quantity:   5, source: "test", sourceId: "q2" });
    await createTestCryptoTransaction(asset.id, { type: "SELL", quantity:  -3, source: "test", sourceId: "q3" });

    // Import a few more via confirm
    const res = await confirmPOST(
      new Request(`${BASE}/api/investments/import/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [
            { rowIndex: 3, date: "2023-07-01", type: "BUY",  ticker: "SOL", quantity:  2, source: "test2", sourceId: "q4" },
            { rowIndex: 4, date: "2023-07-02", type: "SELL", ticker: "SOL", quantity: -1, source: "test2", sourceId: "q5" },
          ],
          assetMapping: { SOL: asset.id },
        }),
      })
    );
    expect(res.status).toBe(200);

    // Verify stats via the stats endpoint
    const { GET } = await import("@/app/api/investments/assets/[id]/stats/route");
    const statsRes = await GET(
      new Request(`${BASE}/api/investments/assets/${asset.id}/stats`),
      { params: { id: asset.id } }
    );
    const stats = await statsRes.json();
    // 10 + 5 - 3 + 2 - 1 = 13
    expect(stats.totalQuantity).toBeCloseTo(13, 5);
  });
});
