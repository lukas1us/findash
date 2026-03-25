export type CsvFormat = "airbank" | "revolut" | "coinmate" | "cryptocom";
export type ImportModule = "finance" | "investments";

// ─── Finance rows (Air Bank, Revolut) ─────────────────────────────────────────

export interface FinancePreviewRow {
  rowIndex: number;
  date: string;           // YYYY-MM-DD
  amount: number;         // absolute value, always >= 0
  type: "INCOME" | "EXPENSE";
  description: string;
  externalId?: string;    // source dedup key
  // FX (Revolut non-CZK)
  originalCurrency?: string;
  originalAmount?: number;
  exchangeRate?: number;  // 1 originalCurrency = exchangeRate CZK
  isFeeRow?: boolean;     // Revolut companion fee row
  // Status
  isDuplicate?: boolean;
  parseError?: string;
}

// ─── Investment rows (Coinmate, Crypto.com) ───────────────────────────────────

export type InvestmentAction = "BUY" | "DEPOSIT";

export interface InvestmentPreviewRow {
  rowIndex: number;
  date: string;           // YYYY-MM-DD
  ticker: string;         // crypto ticker from CSV (e.g. "BTC")
  quantity: number;       // amount of crypto
  pricePerUnit: number;   // in CZK (may be 0 if unknown)
  fees: number;           // in CZK
  action: InvestmentAction;
  description?: string;
  externalId?: string;
  isDuplicate?: boolean;
  parseError?: string;
}

// ─── Preview API response ─────────────────────────────────────────────────────

export interface PreviewResult {
  format: CsvFormat | "unknown";
  module: ImportModule;
  financeRows: FinancePreviewRow[];
  investmentRows: InvestmentPreviewRow[];
  tickers: string[];      // unique tickers from investment rows
  currencies: string[];   // unique non-CZK currencies from finance rows (Revolut)
  errorCount: number;
  warnings: string[];
}

// ─── Confirm API request / response ──────────────────────────────────────────

export interface ConfirmFinanceRow {
  date: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  description: string;
  categoryId: string;
  externalId?: string;
  originalCurrency?: string;
  originalAmount?: number;
  exchangeRate?: number;
}

export interface ConfirmInvestmentRow {
  date: string;
  ticker: string;
  assetId: string;
  quantity: number;
  pricePerUnit: number;
  fees: number;
  notes?: string;
  externalId?: string;
}

export interface ConfirmRequest {
  module: ImportModule;
  // Finance
  accountId?: string;
  financeRows?: ConfirmFinanceRow[];
  // Investments
  investmentRows?: ConfirmInvestmentRow[];
}

export interface ConfirmResult {
  imported: number;
  skipped: number;
  errors: string[];
}
