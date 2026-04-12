"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/formatters";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

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
}

const TYPE_COLORS: Record<string, string> = {
  CRYPTO: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  REAL_ESTATE: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  GOLD_SILVER: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  OTHER: "bg-gray-500/20 text-gray-700 dark:text-gray-400",
};

export function AssetTable({ assets }: { assets: AssetRow[] }) {
  const { t } = useTranslation();

  const TYPE_LABELS = useMemo(() => ({
    CRYPTO: t("investments.assetTableComponent.types.CRYPTO"),
    REAL_ESTATE: t("investments.assetTableComponent.types.REAL_ESTATE"),
    GOLD_SILVER: t("investments.assetTableComponent.types.GOLD_SILVER"),
    OTHER: t("investments.assetTableComponent.types.OTHER"),
  }), [t]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("investments.assetTableComponent.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("investments.assetTableComponent.asset")}</TableHead>
              <TableHead className="text-right">{t("investments.assetTableComponent.quantity")}</TableHead>
              <TableHead className="text-right">{t("investments.assetTableComponent.avgBuy")}</TableHead>
              <TableHead className="text-right">{t("investments.assetTableComponent.currentPrice")}</TableHead>
              <TableHead className="text-right">{t("investments.assetTableComponent.value")}</TableHead>
              <TableHead className="text-right">{t("investments.assetTableComponent.pnl")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{a.ticker}</span>
                      <span className={`text-xs rounded px-1.5 py-0.5 font-medium ${TYPE_COLORS[a.type]}`}>
                        {TYPE_LABELS[a.type as keyof typeof TYPE_LABELS] ?? a.type}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatNumber(a.totalQty)}</TableCell>
                <TableCell className="text-right">{formatCurrency(a.avgBuyPrice)}</TableCell>
                <TableCell className="text-right">{formatCurrency(a.currentPrice)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(a.currentValue)}</TableCell>
                <TableCell className="text-right">
                  <div className={`flex items-center justify-end gap-1 ${a.pnlCzk >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {a.pnlCzk >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    <div>
                      <p className="text-sm font-medium">{formatPercent(a.pnlPct)}</p>
                      <p className="text-xs">{formatCurrency(a.pnlCzk)}</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {assets.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {t("investments.assetTableComponent.noAssets")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
