/**
 * Unit tests for PDF bank statement parsers.
 * No real PDF files are opened — all inputs are hardcoded text strings.
 */

import {
  detectPDFSource,
  parseAirBankPDF,
  parseRevolutPDF,
  parseCzechAmount,
  parseUsAmount,
  parseCzechDate,
  parseRevolutDate,
  detectCategory,
} from "@/lib/pdf-parsers/pdf-parser";

// ─── Sample texts ─────────────────────────────────────────────────────────────

const AIR_BANK_SAMPLE = `Lukáš Krása
Hřbitovní 1181
560 02 Česká Třebová
Česká republika
Výpis z běžného účtu
Air Bank a.s. / BIC AIRACZPP
Číslo účtu: 2715592010 / 3030
Počáteční zůstatek: 1 519,62 Připsáno na účet: 386 163,44
Konečný zůstatek: 4 083,87 Odepsáno z účtu: 383 599,19
Zaúčtování
Provedení
Typ
Kód transakce
Název
Číslo účtu / debetní karty Detaily Částka CZK Poplatky
01.01.2026
28.12.2025
Platba kartou
146232191212
Lukáš Krása
516844******6992
CAFE & BAR NO3 Smetanovo nam. 73,
Litomysl-Mest, 570 01, CZE
-550,00 0,00
01.01.2026
01.01.2026
Příchozí úhrada
146276303532
Lukáš Krása
2715592029 / 3030
3 000,00 0,00
05.01.2026
05.01.2026
Odchozí úhrada
146515691362 2301588986 / 2010
VS2017003994 -2 240,00 0,00
06.01.2026
06.01.2026
Odchozí úhrada
146600451012 19-2784000277 / 0100
VS21787793
Platba PRE
-950,00 0,00
09.01.2026
09.01.2026
Příchozí úhrada
146915353392
NEWPS.CZ S.R.O.
5081103433 / 5500
VS9 / KS138
933 PREVOD NA UCET
78 032,00 0,00
05.01.2026
02.01.2026
Platba kartou
146561510682
Lukáš Krása
516844******6992
Wolt Bubenska 147, Czech, 170 00, CZE -273,52 0,00`;

const REVOLUT_SAMPLE = `CZK Statement
Generated on the Mar 26, 2026
Revolut Bank UAB
LUKAS KRASA
Balance summary
Product Opening balance Money out Money in Closing
balance
Account (Current Account) 100.00 CZK 121,324.14 CZK 122,488.50 CZK 1,264.36 CZK
Total 100.00 CZK 121,324.14 CZK 122,488.50 CZK 1,264.36 CZK
Pending from January 1, 2026 to March 26, 2026
Start date Description Money out Money in
Mar 26, 2026 LaFresca Cantina & Café 208.31 CZK
Account transactions from January 1, 2026 to March 26, 2026
Date Description Money out Money in Balance
Jan 4, 2026 Apple Pay top-up by *8908 1,600.00 CZK 1,700.00 CZK
From: *8908
Jan 4, 2026 Exchanged to EUR 1,700.00 CZK 0.00 CZK
€70.13
Jan 5, 2026 Apple Pay top-up by *8908 3,000.00 CZK 3,000.00 CZK
From: *8908
Jan 6, 2026 Transfer from PETR BEZOUSEK 194.50 CZK 3,194.50 CZK
Reference: Youtube premium
From: PETR BEZOUSEK
Jan 6, 2026 YouTube 389.00 CZK 2,805.50 CZK
To: Google Youtubepremium, London
Card: 516794******3702
Jan 7, 2026 Spotify 299.00 CZK 2,506.50 CZK
To: Spotify, Stockholm
Card: 516794******3702
Jan 8, 2026 Lidl 157.50 CZK 2,349.00 CZK
To: Lidl Dekuje Za Nakup, Praha
Card: 516794******3702`;

// ─── detectPDFSource ──────────────────────────────────────────────────────────

describe("detectPDFSource", () => {
  it("detects Air Bank from statement text", () => {
    expect(detectPDFSource(AIR_BANK_SAMPLE)).toBe("AIRBANK");
  });

  it("detects Revolut from statement text", () => {
    expect(detectPDFSource(REVOLUT_SAMPLE)).toBe("REVOLUT");
  });

  it("returns UNKNOWN for unrecognised text", () => {
    expect(detectPDFSource("Hello world, random text")).toBe("UNKNOWN");
  });

  it("detects Air Bank by BIC code AIRACZPP", () => {
    expect(detectPDFSource("Air Bank a.s. / BIC AIRACZPP")).toBe("AIRBANK");
  });

  it("detects Revolut by Money out column header combined with Revolut name", () => {
    expect(detectPDFSource("Revolut Bank UAB\nDate Description Money out Money in Balance")).toBe("REVOLUT");
  });
});

// ─── parseCzechAmount ─────────────────────────────────────────────────────────

describe("parseCzechAmount", () => {
  it("parses simple negative amount", () => {
    expect(parseCzechAmount("-550,00")).toBe(-550);
  });

  it("parses positive amount with thousands separator", () => {
    expect(parseCzechAmount("3 000,00")).toBe(3000);
  });

  it("parses large amount", () => {
    expect(parseCzechAmount("78 032,00")).toBe(78032);
  });

  it("parses large negative amount", () => {
    expect(parseCzechAmount("-50 000,00")).toBe(-50000);
  });

  it("parses amount with cents", () => {
    expect(parseCzechAmount("-273,52")).toBeCloseTo(-273.52, 2);
  });
});

// ─── parseUsAmount ────────────────────────────────────────────────────────────

describe("parseUsAmount", () => {
  it("parses simple amount", () => {
    expect(parseUsAmount("389.00")).toBe(389);
  });

  it("parses amount with thousands comma separator", () => {
    expect(parseUsAmount("1,600.00")).toBe(1600);
  });

  it("parses zero", () => {
    expect(parseUsAmount("0.00")).toBe(0);
  });

  it("parses amount with cents", () => {
    expect(parseUsAmount("605.47")).toBeCloseTo(605.47, 2);
  });
});

// ─── parseCzechDate ───────────────────────────────────────────────────────────

describe("parseCzechDate", () => {
  it("parses DD.MM.YYYY correctly", () => {
    const d = parseCzechDate("15.03.2024");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2024-03-15T00:00:00.000Z");
  });

  it("parses beginning of year", () => {
    const d = parseCzechDate("01.01.2026");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
    expect(d!.getUTCMonth()).toBe(0);
    expect(d!.getUTCDate()).toBe(1);
  });

  it("returns null for non-date string", () => {
    expect(parseCzechDate("not a date")).toBeNull();
    expect(parseCzechDate("")).toBeNull();
  });
});

// ─── parseRevolutDate ─────────────────────────────────────────────────────────

describe("parseRevolutDate", () => {
  it("parses 'Jan 4, 2026' correctly", () => {
    const d = parseRevolutDate("Jan 4, 2026");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });

  it("parses double-digit day", () => {
    const d = parseRevolutDate("Mar 26, 2026");
    expect(d).not.toBeNull();
    expect(d!.getUTCDate()).toBe(26);
    expect(d!.getUTCMonth()).toBe(2); // March = 2
  });

  it("returns null for invalid string", () => {
    expect(parseRevolutDate("not a date")).toBeNull();
    expect(parseRevolutDate("2026-01-04")).toBeNull();
  });
});

// ─── detectCategory ───────────────────────────────────────────────────────────

describe("detectCategory", () => {
  it("matches 'nájem' → Nájem", () => {
    expect(detectCategory("Platba nájem")).toBe("Nájem");
  });

  it("matches 'Albert' → Jídlo", () => {
    expect(detectCategory("Albert Vam Dekuje")).toBe("Jídlo");
  });

  it("matches 'Lidl' → Jídlo", () => {
    expect(detectCategory("Lidl Praha")).toBe("Jídlo");
  });

  it("matches 'Wolt' → Jídlo", () => {
    expect(detectCategory("Platba kartou – Wolt")).toBe("Jídlo");
  });

  it("matches 'billa' case-insensitively → Jídlo", () => {
    expect(detectCategory("BILLA SUPERMARKET")).toBe("Jídlo");
  });

  it("matches 'netflix' → Zábava", () => {
    expect(detectCategory("Netflix subscription")).toBe("Zábava");
  });

  it("matches 'spotify' → Zábava", () => {
    expect(detectCategory("Spotify P3e69fafcb")).toBe("Zábava");
  });

  it("matches 'youtube' → Zábava", () => {
    expect(detectCategory("YouTube Premium")).toBe("Zábava");
  });

  it("matches 'cinema' → Zábava", () => {
    expect(detectCategory("CINEMA CITY CHODOV")).toBe("Zábava");
  });

  it("matches 'uber' → Doprava", () => {
    expect(detectCategory("Uber *ride")).toBe("Doprava");
  });

  it("defaults to Ostatní for unknown description", () => {
    expect(detectCategory("Platba PRE")).toBe("Ostatní");
    expect(detectCategory("SEXSHOP.CZ")).toBe("Ostatní");
    expect(detectCategory("dm drogerie")).toBe("Ostatní");
  });
});

// ─── parseAirBankPDF ──────────────────────────────────────────────────────────

describe("parseAirBankPDF", () => {
  let txs: ReturnType<typeof parseAirBankPDF>;

  beforeAll(() => {
    txs = parseAirBankPDF(AIR_BANK_SAMPLE);
  });

  it("parses 6 transactions from sample", () => {
    expect(txs).toHaveLength(6);
  });

  it("correctly classifies EXPENSE for negative amount", () => {
    const first = txs[0];
    expect(first.type).toBe("EXPENSE");
    expect(first.amount).toBe(550);
    expect(first.source).toBe("AIRBANK_PDF");
  });

  it("correctly classifies INCOME for positive amount", () => {
    const income = txs[1];
    expect(income.type).toBe("INCOME");
    expect(income.amount).toBe(3000);
  });

  it("parses merchant description for card payment", () => {
    const first = txs[0];
    expect(first.description).toContain("CAFE & BAR NO3");
  });

  it("parses date correctly", () => {
    expect(txs[0].date.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("handles amount+description on same line (Wolt)", () => {
    const wolt = txs.find((t) => t.description.includes("Wolt"));
    expect(wolt).toBeDefined();
    expect(wolt!.amount).toBeCloseTo(273.52, 2);
  });

  it("handles large income correctly (78 032,00)", () => {
    const large = txs.find((t) => t.description.includes("PREVOD NA UCET") || t.amount > 50000);
    expect(large).toBeDefined();
    expect(large!.amount).toBe(78032);
    expect(large!.type).toBe("INCOME");
  });

  it("generates deterministic sourceId", () => {
    const txsAgain = parseAirBankPDF(AIR_BANK_SAMPLE);
    for (let i = 0; i < txs.length; i++) {
      expect(txs[i].sourceId).toBe(txsAgain[i].sourceId);
    }
  });

  it("sourceId is unique per transaction", () => {
    const ids = txs.map((t) => t.sourceId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ─── parseRevolutPDF ──────────────────────────────────────────────────────────

describe("parseRevolutPDF", () => {
  let txs: ReturnType<typeof parseRevolutPDF>;

  beforeAll(() => {
    txs = parseRevolutPDF(REVOLUT_SAMPLE);
  });

  it("skips pending transactions (208.31 CZK)", () => {
    // The 208.31 CZK pending transaction must NOT appear
    const pending = txs.find((t) => Math.abs(t.amount - 208.31) < 0.01);
    expect(pending).toBeUndefined();
  });

  it("parses 7 completed transactions from sample", () => {
    expect(txs).toHaveLength(7);
  });

  it("detects Apple Pay top-up as INCOME", () => {
    const topup = txs.find((t) => t.description.includes("Apple Pay top-up"));
    expect(topup).toBeDefined();
    expect(topup!.type).toBe("INCOME");
    expect(topup!.amount).toBeCloseTo(1600, 1);
  });

  it("detects Exchanged to EUR as EXPENSE", () => {
    const exchange = txs.find((t) => t.description.includes("Exchanged to EUR"));
    expect(exchange).toBeDefined();
    expect(exchange!.type).toBe("EXPENSE");
    expect(exchange!.amount).toBeCloseTo(1700, 1);
  });

  it("detects YouTube as EXPENSE", () => {
    const yt = txs.find((t) => t.description === "YouTube");
    expect(yt).toBeDefined();
    expect(yt!.type).toBe("EXPENSE");
    expect(yt!.amount).toBeCloseTo(389, 1);
  });

  it("detects Transfer from as INCOME", () => {
    const transfer = txs.find((t) => t.description.includes("Transfer from"));
    expect(transfer).toBeDefined();
    expect(transfer!.type).toBe("INCOME");
  });

  it("parses date correctly", () => {
    const first = txs[0];
    expect(first.date.toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });

  it("generates deterministic sourceId", () => {
    const txsAgain = parseRevolutPDF(REVOLUT_SAMPLE);
    for (let i = 0; i < txs.length; i++) {
      expect(txs[i].sourceId).toBe(txsAgain[i].sourceId);
    }
  });

  it("sourceId is unique per transaction", () => {
    const ids = txs.map((t) => t.sourceId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all transactions have source = REVOLUT_PDF", () => {
    for (const tx of txs) {
      expect(tx.source).toBe("REVOLUT_PDF");
    }
  });
});
