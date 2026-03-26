export type CryptoTxType = "BUY" | "SELL" | "DEPOSIT" | "WITHDRAWAL" | "REWARD" | "SWAP";
export type CryptoFormat = "BINANCE" | "COINMATE_ORDERS" | "COINMATE_HISTORY" | "CRYPTO_COM";

export interface CryptoTxRow {
  rowIndex: number;
  date: string;         // YYYY-MM-DD
  type: CryptoTxType;
  ticker: string;       // asset ticker (e.g. "BTC")
  quantity: number;     // always >= 0
  pricePerUnit: number; // in CZK (0 if unknown)
  totalCZK: number;     // total value in CZK (0 if unknown)
  fee: number;          // fee amount
  feeCurrency: string;  // fee currency (empty string if unknown)
  source: CryptoFormat;
  sourceId?: string;    // dedup key
  notes?: string;
  parseError?: string;
}
