"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { AllocationPieChart } from "@/components/investments/allocation-pie-chart";
import { AssetTable } from "@/components/investments/asset-table";
import { useTranslation } from "@/lib/i18n/context";

interface Stats {
  totalValue: number;
  totalCostBasis: number;
  totalPnlCzk: number;
  totalPnlPct: number;
  allocationPie: { name: string; value: number; color: string }[];
  assets: AssetRow[];
}

interface AssetRow {
  id: string;
  name: string;
  ticker: string;
  type: string;
  totalQty: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  totalCost: number;
  pnlCzk: number;
  pnlPct: number;
  lastPriceUpdate: string | null;
}

export default function InvestmentsPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/investments/stats").then((r) => (r.ok ? r.json() : null)).then(setStats).catch(() => {});
  }, []);

  const isPositive = (stats?.totalPnlCzk ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("investments.overview.title")}</h1>
        <p className="text-muted-foreground">{t("investments.overview.portfolio")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("investments.overview.totalValue")}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalValue ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{t("investments.overview.invested")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("investments.overview.unrealizedPnl")}</CardTitle>
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isPositive ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(stats?.totalPnlCzk ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatPercent(stats?.totalPnlPct ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("investments.overview.invested")}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalCostBasis ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{t("investments.overview.totalAssets")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Allocation chart + table */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <AllocationPieChart data={stats?.allocationPie ?? []} />
        </div>
        <div className="lg:col-span-2">
          <AssetTable assets={stats?.assets ?? []} />
        </div>
      </div>
    </div>
  );
}
