import type { CryptoFormat } from "./crypto-types";

export function detectCryptoFormat(csvText: string): CryptoFormat | "unknown" {
  const text = csvText.replace(/^\uFEFF/, "");
  const header = text.split(/\r?\n/)[0] ?? "";

  if (header.includes("User_ID") && header.includes("UTC_Time") && header.includes("Operation")) {
    return "BINANCE";
  }
  if (header.includes("ORDER ID") && header.includes("DATE FILLED")) {
    return "COINMATE_ORDERS";
  }
  // Coinmate history has Czech headers; differentiate from orders by "Částka měny"
  if (header.includes("Částka měny") && header.includes("Datum")) {
    return "COINMATE_HISTORY";
  }
  if (header.includes("Transaction Kind") && header.includes("Native Currency") && header.includes("Timestamp (UTC)")) {
    return "CRYPTO_COM";
  }
  return "unknown";
}
