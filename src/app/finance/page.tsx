"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { CashFlowChart } from "@/components/finance/cash-flow-chart";
import { ExpensePieChart } from "@/components/finance/expense-pie-chart";
import { RecentTransactions } from "@/components/finance/recent-transactions";
import { useTranslation } from "@/lib/i18n/context";

interface Stats {
  currentMonth: { income: number; expense: number };
  cashFlow: { month: string; income: number; expense: number }[];
  expensesByCategory: { name: string; value: number; color: string }[];
}

export default function FinancePage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [accounts, setAccounts] = useState<{ balance: number }[]>([]);

  useEffect(() => {
    fetch("/api/finance/stats").then((r) => (r.ok ? r.json() : null)).then(setStats).catch(() => {});
    fetch("/api/finance/accounts").then((r) => (r.ok ? r.json() : [])).then(setAccounts).catch(() => {});
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const savings = stats
    ? stats.currentMonth.income - stats.currentMonth.expense
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("finance.overview.title")}</h1>
        <p className="text-muted-foreground">{t("finance.overview.subtitle")}</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("finance.overview.totalBalance")}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            <p className="text-xs text-muted-foreground">{t("finance.overview.acrossAccounts")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("finance.overview.income")} {t("finance.overview.thisMonth")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats?.currentMonth.income ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">{t("finance.overview.subtitle")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("finance.overview.expenses")} {t("finance.overview.thisMonth")}</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats?.currentMonth.expense ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">{t("finance.overview.subtitle")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("finance.overview.balance")} {t("finance.overview.thisMonth")}</CardTitle>
            <PiggyBank className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${savings >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {formatCurrency(savings)}
            </div>
            <p className="text-xs text-muted-foreground">{t("finance.overview.income")} − {t("finance.overview.expenses").toLowerCase()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CashFlowChart data={stats?.cashFlow ?? []} />
        </div>
        <div>
          <ExpensePieChart data={stats?.expensesByCategory ?? []} />
        </div>
      </div>

      {/* Recent transactions */}
      <RecentTransactions />
    </div>
  );
}
