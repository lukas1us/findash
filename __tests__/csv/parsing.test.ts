import fs from "fs";
import path from "path";
import { detectCryptoFormat } from "@/lib/csv-parsers/detect-crypto";
import { parseBinance } from "@/lib/csv-parsers/binance";
import { parseCoinmateOrders } from "@/lib/csv-parsers/coinmate-orders";
import { parseCoinmateHistory } from "@/lib/csv-parsers/coinmate-history";
import { parseCryptoComFull } from "@/lib/csv-parsers/cryptocom-crypto";

const MOCK_DIR = path.join(process.cwd(), "mock_csvs");

function readCsv(filename: string): string {
  return fs.readFileSync(path.join(MOCK_DIR, filename), "utf-8");
}

// ─── Format detection ─────────────────────────────────────────────────────────

describe("detectCryptoFormat", () => {
  it("detects BINANCE from binance_transakce.csv", () => {
    expect(detectCryptoFormat(readCsv("binance_transakce.csv"))).toBe("BINANCE");
  });

  it("detects BINANCE from binance_transakce_2.csv", () => {
    expect(detectCryptoFormat(readCsv("binance_transakce_2.csv"))).toBe("BINANCE");
  });

  it("detects COINMATE_ORDERS from coinmate_transakce.csv", () => {
    expect(detectCryptoFormat(readCsv("coinmate_transakce.csv"))).toBe("COINMATE_ORDERS");
  });

  it("detects COINMATE_HISTORY from transaction_history.csv", () => {
    expect(detectCryptoFormat(readCsv("transaction_history.csv"))).toBe("COINMATE_HISTORY");
  });

  it("detects CRYPTO_COM from crypto_transactions_record CSV", () => {
    const files = fs.readdirSync(MOCK_DIR).filter((f) => f.startsWith("crypto_transactions_record"));
    expect(files.length).toBeGreaterThan(0);
    expect(detectCryptoFormat(readCsv(files[0]))).toBe("CRYPTO_COM");
  });
});

// ─── Binance parser ───────────────────────────────────────────────────────────

describe("parseBinance (binance_transakce.csv)", () => {
  let rows: ReturnType<typeof parseBinance>;

  beforeAll(() => {
    rows = parseBinance(readCsv("binance_transakce.csv"));
  });

  it("returns at least one row", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("all rows have no parseError", () => {
    expect(rows.filter((r) => r.parseError)).toHaveLength(0);
  });

  it("all rows have source = BINANCE", () => {
    expect(rows.every((r) => r.source === "BINANCE")).toBe(true);
  });

  it("all rows have valid YYYY-MM-DD dates", () => {
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))).toBe(true);
  });

  it("all rows have quantity >= 0", () => {
    expect(rows.every((r) => r.quantity >= 0)).toBe(true);
  });

  it("does not contain P2P Trading rows", () => {
    // P2P Trading should be skipped entirely
    expect(rows.every((r) => r.type !== "DEPOSIT" || r.ticker !== "USDT")).toBe(true);
  });

  it("skips Withdraw rows", () => {
    // Withdraw operation has negative Change, should not appear
    const withdrawRows = rows.filter((r) => r.notes?.toLowerCase().includes("withdraw"));
    expect(withdrawRows).toHaveLength(0);
  });
});

describe("parseBinance (binance_transakce_2.csv)", () => {
  let rows: ReturnType<typeof parseBinance>;

  beforeAll(() => {
    rows = parseBinance(readCsv("binance_transakce_2.csv"));
  });

  it("returns at least one row", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("contains BUY rows for BTC", () => {
    const btcRows = rows.filter((r) => r.type === "BUY" && r.ticker === "BTC");
    expect(btcRows.length).toBeGreaterThan(0);
    const first = btcRows[0];
    expect(first.date).toBe("2022-01-21");
    expect(first.quantity).toBeCloseTo(0.00113, 5);
  });

  it("has no parseError rows for known operations", () => {
    expect(rows.filter((r) => r.parseError).length).toBe(0);
  });

  it("contains SELL rows for LTC from Transaction Sold", () => {
    const sellRows = rows.filter((r) => r.type === "SELL" && r.ticker === "LTC");
    expect(sellRows.length).toBeGreaterThan(0);
    expect(sellRows.every((r) => r.quantity > 0)).toBe(true);
  });
});

// ─── Coinmate Orders parser ───────────────────────────────────────────────────

describe("parseCoinmateOrders (coinmate_transakce.csv)", () => {
  let rows: ReturnType<typeof parseCoinmateOrders>;

  beforeAll(() => {
    rows = parseCoinmateOrders(readCsv("coinmate_transakce.csv"));
  });

  it("returns at least one row", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("all rows are FILLED (non-FILLED skipped)", () => {
    expect(rows.every((r) => r.parseError == null)).toBe(true);
  });

  it("all rows have source = COINMATE_ORDERS", () => {
    expect(rows.every((r) => r.source === "COINMATE_ORDERS")).toBe(true);
  });

  it("all rows have quantity > 0", () => {
    expect(rows.every((r) => r.quantity > 0)).toBe(true);
  });

  it("first row is a BUY of ADA", () => {
    const row = rows[0];
    expect(row.type).toBe("BUY");
    expect(row.ticker).toBe("ADA");
    expect(row.date).toBe("2024-02-08");
    expect(row.quantity).toBeCloseTo(1738.670275, 4);
    expect(row.pricePerUnit).toBeCloseTo(12.2617, 3);
    expect(row.totalCZK).toBeCloseTo(21319.05331097, 2);
    expect(row.sourceId).toBe("2572688881");
  });

  it("all rows have BUY or SELL type", () => {
    expect(rows.every((r) => r.type === "BUY" || r.type === "SELL")).toBe(true);
  });

  it("extracts ticker from PAIR column (e.g. ADA_CZK → ADA)", () => {
    expect(rows.every((r) => !r.ticker.includes("_"))).toBe(true);
  });
});

// ─── Coinmate History parser ──────────────────────────────────────────────────

describe("parseCoinmateHistory (transaction_history.csv)", () => {
  let rows: ReturnType<typeof parseCoinmateHistory>;

  beforeAll(() => {
    rows = parseCoinmateHistory(readCsv("transaction_history.csv"));
  });

  it("returns at least one row", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("all rows have source = COINMATE_HISTORY", () => {
    expect(rows.every((r) => r.source === "COINMATE_HISTORY")).toBe(true);
  });

  it("all rows have quantity >= 0", () => {
    expect(rows.every((r) => r.quantity >= 0)).toBe(true);
  });

  it("contains a BUY row for ADA", () => {
    const row = rows.find((r) => r.type === "BUY" && r.ticker === "ADA");
    expect(row).toBeDefined();
    expect(row!.date).toBe("2024-02-08");
    expect(row!.quantity).toBeCloseTo(1738.670275, 4);
    expect(row!.pricePerUnit).toBeCloseTo(12.2598, 3);
    expect(row!.fee).toBeCloseTo(74.60512443, 4);
    expect(row!.feeCurrency).toBe("CZK");
  });

  it("contains a SELL row for XRP", () => {
    const row = rows.find((r) => r.type === "SELL" && r.ticker === "XRP");
    expect(row).toBeDefined();
    expect(row!.date).toBe("2024-12-02");
    expect(row!.quantity).toBeCloseTo(20.46380372, 5);
    expect(row!.pricePerUnit).toBeCloseTo(57.5755, 3);
  });

  it("contains a DEPOSIT row for CZK", () => {
    const row = rows.find((r) => r.type === "DEPOSIT" && r.ticker === "CZK");
    expect(row).toBeDefined();
    expect(row!.date).toBe("2024-02-07");
    expect(row!.quantity).toBeCloseTo(25000, 0);
  });

  it("contains a WITHDRAWAL row", () => {
    const row = rows.find((r) => r.type === "WITHDRAWAL");
    expect(row).toBeDefined();
  });

  it("includes all valid types (BUY, SELL, DEPOSIT, WITHDRAWAL)", () => {
    const types = new Set(rows.map((r) => r.type));
    expect(types.has("BUY")).toBe(true);
    expect(types.has("SELL")).toBe(true);
    expect(types.has("DEPOSIT")).toBe(true);
    expect(types.has("WITHDRAWAL")).toBe(true);
  });

  it("totalCZK is populated for CZK-priced rows", () => {
    const buyAda = rows.find((r) => r.type === "BUY" && r.ticker === "ADA");
    expect(buyAda!.totalCZK).toBeGreaterThan(0);
  });
});

// ─── Crypto.com parser ────────────────────────────────────────────────────────

describe("parseCryptoComFull", () => {
  let rows: ReturnType<typeof parseCryptoComFull>;
  let filename: string;

  beforeAll(() => {
    const files = fs.readdirSync(MOCK_DIR).filter((f) => f.startsWith("crypto_transactions_record"));
    filename = files[0];
    rows = parseCryptoComFull(readCsv(filename));
  });

  it("returns at least one row", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("all rows have source = CRYPTO_COM", () => {
    expect(rows.every((r) => r.source === "CRYPTO_COM")).toBe(true);
  });

  it("all rows have quantity >= 0", () => {
    expect(rows.every((r) => r.quantity >= 0)).toBe(true);
  });

  it("all rows have valid YYYY-MM-DD dates", () => {
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))).toBe(true);
  });

  it("contains REWARD rows (DPoS interest)", () => {
    const row = rows.find(
      (r) => r.type === "REWARD" && r.ticker === "CRO" && r.date === "2025-07-23"
    );
    expect(row).toBeDefined();
    expect(row!.quantity).toBeCloseTo(5.3652204, 5);
    expect(row!.totalCZK).toBeCloseTo(13.73323882, 3);
  });

  it("contains REWARD rows (card cashback)", () => {
    const row = rows.find(
      (r) => r.type === "REWARD" && r.ticker === "CRO" && r.date === "2025-07-21"
    );
    expect(row).toBeDefined();
    expect(row!.quantity).toBeCloseTo(7.12736182, 5);
  });

  it("contains BUY rows from viban_purchase (EUR → ADA)", () => {
    const row = rows.find((r) => r.type === "BUY" && r.ticker === "ADA");
    expect(row).toBeDefined();
    // Earliest ADA purchase: 2024-09-17, 515.38 ADA
    expect(row!.date).toBe("2024-09-17");
    expect(row!.quantity).toBeCloseTo(515.38, 2);
    expect(row!.totalCZK).toBeGreaterThan(0);
  });

  it("contains DEPOSIT rows (crypto_deposit)", () => {
    const row = rows.find((r) => r.type === "DEPOSIT" && r.ticker === "XLM");
    expect(row).toBeDefined();
    expect(row!.date).toBe("2025-07-13");
    expect(row!.quantity).toBeCloseTo(451.53, 2);
    expect(row!.totalCZK).toBeGreaterThan(0);
  });

  it("contains SWAP rows (crypto_viban_exchange — sell crypto for EUR)", () => {
    const row = rows.find((r) => r.type === "SWAP" && r.ticker === "PEPE");
    expect(row).toBeDefined();
    expect(row!.date).toBe("2024-11-14");
    expect(row!.quantity).toBeCloseTo(5000000, 0);
  });

  it("includes multiple distinct transaction types", () => {
    const types = new Set(rows.map((r) => r.type));
    expect(types.size).toBeGreaterThanOrEqual(3);
  });
});
