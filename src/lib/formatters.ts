import { format, parseISO } from "date-fns";
import { cs } from "date-fns/locale";

export function formatCurrency(amount: number, currency = "CZK"): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyPrecise(amount: number, currency = "CZK"): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd.MM.yyyy", { locale: cs });
}

export function formatMonth(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "LLLL yyyy", { locale: cs });
}

export function formatMonthShort(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM yy", { locale: cs });
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "always",
  }).format(value / 100);
}

export function formatNumber(value: number, decimals = 4): string {
  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}
