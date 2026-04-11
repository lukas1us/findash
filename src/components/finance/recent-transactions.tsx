"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
        <CardTitle className="text-base">Poslední transakce</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/finance/transactions">Zobrazit vše</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Popis</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Účet</TableHead>
              <TableHead className="text-right">Částka</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-muted-foreground">{formatDate(t.date)}</TableCell>
                <TableCell>{t.description ?? "—"}</TableCell>
                <TableCell>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: t.category.color }}
                  >
                    {t.category.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{t.account.name}</TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    t.type === "INCOME" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {t.type === "INCOME" ? "+" : "−"}
                  {formatCurrency(t.amount)}
                </TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Žádné transakce
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
