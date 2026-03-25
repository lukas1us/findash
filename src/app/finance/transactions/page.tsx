"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { TransactionForm } from "@/components/finance/transaction-form";
import { useToast } from "@/components/ui/use-toast";
import { format, subMonths } from "date-fns";
import Link from "next/link";

interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  description: string | null;
  date: string;
  account: { name: string };
  category: { name: string; color: string };
}
interface Category { id: string; name: string }

// Generate last 12 months options
function getMonthOptions() {
  const options = [];
  for (let i = 0; i < 12; i++) {
    const d = subMonths(new Date(), i);
    options.push({ value: format(d, "yyyy-MM"), label: format(d, "LLLL yyyy") });
  }
  return options;
}

export default function TransactionsPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const monthOptions = getMonthOptions();

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filterMonth) params.set("month", filterMonth);
    if (filterCategory !== "all") params.set("categoryId", filterCategory);
    if (filterType !== "all") params.set("type", filterType);
    fetch(`/api/finance/transactions?${params}`).then((r) => r.json()).then(setTransactions);
  }, [filterMonth, filterCategory, filterType]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/finance/categories").then((r) => r.json()).then(setCategories);
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Smazat transakci?")) return;
    await fetch(`/api/finance/transactions/${id}`, { method: "DELETE" });
    toast({ title: "Transakce smazána" });
    load();
  }

  const totalIncome = transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transakce</h1>
          <p className="text-muted-foreground">Správa příjmů a výdajů</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/finance/transactions/import">
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Link>
          </Button>
          <Button onClick={() => { setEditTx(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nová transakce
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Měsíc" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny kategorie</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vše</SelectItem>
            <SelectItem value="INCOME">Příjmy</SelectItem>
            <SelectItem value="EXPENSE">Výdaje</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Příjmy</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Výdaje</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Bilance</p>
            <p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {formatCurrency(totalIncome - totalExpense)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{transactions.length} transakcí</CardTitle>
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
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">{formatDate(t.date)}</TableCell>
                  <TableCell>{t.description ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: t.category.color }}
                    >
                      {t.category.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.account.name}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${t.type === "INCOME" ? "text-green-600" : "text-red-600"}`}
                  >
                    {t.type === "INCOME" ? "+" : "−"}
                    {formatCurrency(t.amount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => { setEditTx(t); setFormOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Žádné transakce pro zvolený filtr
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransactionForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        transaction={editTx}
      />
    </div>
  );
}
