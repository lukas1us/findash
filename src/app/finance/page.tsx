"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { CashFlowChart } from "@/components/finance/cash-flow-chart";
import { ExpensePieChart } from "@/components/finance/expense-pie-chart";
import { RecentTransactions } from "@/components/finance/recent-transactions";

interface Stats {
  currentMonth: { income: number; expense: number };
  cashFlow: { month: string; income: number; expense: number }[];
  expensesByCategory: { name: string; value: number; color: string }[];
}

export default function FinancePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [accounts, setAccounts] = useState<{ balance: number }[]>([]);

  useEffect(() => {
    fetch("/api/finance/stats").then((r) => r.json()).then(setStats);
    fetch("/api/finance/accounts").then((r) => r.json()).then(setAccounts);
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const savings = stats
    ? stats.currentMonth.income - stats.currentMonth.expense
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Finance</h1>
        <p className="text-muted-foreground">Přehled příjmů, výdajů a zůstatků</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Celkový zůstatek</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            <p className="text-xs text-muted-foreground">Napříč všemi účty</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Příjmy (tento měsíc)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats?.currentMonth.income ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">Aktuální měsíc</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Výdaje (tento měsíc)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats?.currentMonth.expense ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">Aktuální měsíc</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Úspory (tento měsíc)</CardTitle>
            <PiggyBank className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${savings >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {formatCurrency(savings)}
            </div>
            <p className="text-xs text-muted-foreground">Příjmy − výdaje</p>
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
