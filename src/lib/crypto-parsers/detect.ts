import type { CryptoFormat } from "./types";

export function detectCryptoFormat(csvText: string): CryptoFormat | "unknown" {
  const text   = csvText.replace(/^\uFEFF/, "");
  const header = text.split(/\r?\n/)[0] ?? "";

  // Binance: UTC_Time + Operation + Coin (comma-delimited)
  if (header.includes("UTC_Time") && header.includes("Operation") && header.includes("Coin")) {
    return "binance";
  }

  // Coinmate Orders: ORDER ID + PAIR + STATUS (comma or semicolon)
  if (header.includes("ORDER ID") && header.includes("PAIR") && header.includes("STATUS")) {
    return "coinmate_orders";
  }

  // Coinmate Transaction History: Částka měny + Status (semicolon, Czech cols)
  if (header.includes("Částka měny") && header.includes("Status")) {
    return "coinmate_history";
  }

  // Crypto.com: Transaction Kind + Native Amount
  if (header.includes("Transaction Kind") && header.includes("Native Amount")) {
    return "cryptocom";
  }

  return "unknown";
}
