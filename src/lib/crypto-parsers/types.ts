export type CryptoTxType = "BUY" | "SELL" | "DEPOSIT" | "WITHDRAWAL" | "REWARD" | "SWAP";
export type CryptoFormat =
  | "binance"
  | "coinmate_orders"
  | "coinmate_history"
  | "cryptocom";

export interface CryptoPreviewRow {
  rowIndex:     number;
  date:         string;        // YYYY-MM-DD
  type:         CryptoTxType;
  ticker:       string;        // crypto coin (BTC, ADA, …)
  quantity:     number;        // positive = receive, negative = spend/sell
  pricePerUnit?: number;       // CZK per 1 unit; null for deposit/withdrawal/reward
  totalCZK?:    number;
  fee?:         number;
  feeCurrency?: string;
  source:       string;        // BINANCE | COINMATE_ORDERS | COINMATE_HISTORY | CRYPTO_COM
  sourceId?:    string;        // dedup key — always set for known formats
  notes?:       string;
  isDuplicate?: boolean;
  parseError?:  string;
}

// Fiat tickers we skip as the "asset" side of a transaction
export const FIAT_TICKERS = new Set([
  "CZK", "EUR", "USD", "GBP", "CHF", "PLN", "HUF",
  "USDT", "USDC", "BUSD", "TUSD", "DAI", "FDUSD",
]);

export interface CryptoFilePreview {
  filename:       string;
  format:         CryptoFormat | "unknown";
  rows:           CryptoPreviewRow[];
  totalCount:     number;
  toImportCount:  number;
  duplicateCount: number;
  errorCount:     number;
  warnings:       string[];
}
