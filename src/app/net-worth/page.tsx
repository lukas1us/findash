"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Wallet, TrendingUp, BarChart3, Save, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { format, parseISO } from "date-fns";
import { useTranslation } from "@/lib/i18n/context";
import { i } from "@/lib/i18n/context";

interface Snapshot {
  id: number;
  date: string;
  cashTotal: number;
  investmentsTotal: number;
  total: number;
}

export default function NetWorthPage() {
  const { t } = useTranslation();
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [months] = useState(12);

  const loadHistory = useCallback(() => {
    setLoadError(null);
    fetch(`/api/net-worth/history?months=${months}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not ok"))))
      .then((data) => {
        if (Array.isArray(data)) {
          setHistory(data);
        } else {
          setLoadError(data.error ?? t("netWorth.loadError"));
        }
      })
      .catch(() => setLoadError(t("netWorth.loadError")));
  }, [months, t]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/net-worth/snapshot", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? t("netWorth.saveError"));
        return;
      }
      loadHistory();
    } catch {
      setSaveError(t("netWorth.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const latest = history[history.length - 1] ?? null;

  const chartData = history.map((s) => ({
    date: format(parseISO(s.date), "MM/yyyy"),
    cashTotal: s.cashTotal,
    investmentsTotal: s.investmentsTotal,
    total: s.total,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("netWorth.title")}</h1>
          <p className="text-muted-foreground">{t("netWorth.subtitle")}</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
              {t("netWorth.saving")}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {t("netWorth.saveSnapshot")}
            </>
          )}
        </Button>
      </div>

      {/* Error banners */}
      {loadError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {loadError}
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {saveError}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("netWorth.cash")}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(latest?.cashTotal ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">{t("netWorth.cashDesc")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("netWorth.investments")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(latest?.investmentsTotal ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">{t("netWorth.investmentsDesc")}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("netWorth.total")}</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {formatCurrency(latest?.total ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {latest
                ? i(t("netWorth.lastSnapshot"), { date: format(parseISO(latest.date), "dd.MM.yyyy") })
                : t("netWorth.noSnapshot")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("netWorth.chartTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
              <BarChart3 className="h-10 w-10 opacity-30" />
              <p className="text-sm">
                {t("netWorth.noDataHint")}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "cashTotal"
                      ? t("netWorth.cashLabel")
                      : name === "investmentsTotal"
                      ? t("netWorth.investmentsLabel")
                      : t("netWorth.netWorthLabel"),
                  ]}
                  labelClassName="font-medium"
                />
                <Legend
                  formatter={(value) =>
                    value === "cashTotal"
                      ? t("netWorth.cashLabel")
                      : value === "investmentsTotal"
                      ? t("netWorth.investmentsLabel")
                      : t("netWorth.netWorthLabel")
                  }
                />
                <Area
                  type="monotone"
                  dataKey="cashTotal"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorCash)"
                />
                <Area
                  type="monotone"
                  dataKey="investmentsTotal"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#colorInv)"
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  fill="url(#colorTotal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
