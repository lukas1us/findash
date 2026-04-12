"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/context";

interface Transaction {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  description: string | null;
  date: string;
  account: { name: string };
  category: { name: string; color: string };
}

export function RecentTransactions() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetch("/api/finance/transactions?limit=10")
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then(setTransactions)
      .catch(() => {});
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("finance.recentTransactions.title")}</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/finance/transactions">{t("finance.recentTransactions.viewAll")}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("finance.recentTransactions.date")}</TableHead>
              <TableHead>{t("finance.recentTransactions.description")}</TableHead>
              <TableHead>{t("finance.recentTransactions.category")}</TableHead>
              <TableHead>{t("finance.recentTransactions.account")}</TableHead>
              <TableHead className="text-right">{t("finance.recentTransactions.amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="text-muted-foreground">{formatDate(tx.date)}</TableCell>
                <TableCell>{tx.description ?? "—"}</TableCell>
                <TableCell>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: tx.category.color }}
                  >
                    {tx.category.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{tx.account.name}</TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    tx.type === "INCOME" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {tx.type === "INCOME" ? "+" : "−"}
                  {formatCurrency(tx.amount)}
                </TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {t("finance.recentTransactions.noTransactions")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
