"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/formatters";
import { TrendingUp, TrendingDown } from "lucide-react";

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

const TYPE_LABELS: Record<string, string> = {
  CRYPTO: "Krypto",
  REAL_ESTATE: "Nemovitosti",
  GOLD_SILVER: "Zlato/Stříbro",
  OTHER: "Ostatní",
};
const TYPE_COLORS: Record<string, string> = {
  CRYPTO: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
  REAL_ESTATE: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  GOLD_SILVER: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  OTHER: "bg-gray-500/20 text-gray-700 dark:text-gray-400",
};

export function AssetTable({ assets }: { assets: AssetRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aktiva</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aktivum</TableHead>
              <TableHead className="text-right">Množství</TableHead>
              <TableHead className="text-right">Prům. nákup</TableHead>
              <TableHead className="text-right">Aktuální cena</TableHead>
              <TableHead className="text-right">Hodnota</TableHead>
              <TableHead className="text-right">P&L</TableHead>
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
                        {TYPE_LABELS[a.type] ?? a.type}
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
                  Žádná aktiva
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
