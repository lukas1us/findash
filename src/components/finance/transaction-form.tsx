"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

interface Category { id: string; name: string; type: string }
interface Account { id: string; name: string }
interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  description: string | null;
  date: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  transaction?: Transaction | null;
}

export function TransactionForm({ open, onClose, onSaved, transaction }: Props) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({
    accountId: "",
    categoryId: "",
    amount: "",
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/finance/categories").then((r) => (r.ok ? r.json() : [])).then(setCategories).catch(() => {});
    fetch("/api/finance/accounts").then((r) => (r.ok ? r.json() : [])).then(setAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    if (transaction) {
      setForm({
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        amount: String(transaction.amount),
        type: transaction.type,
        description: transaction.description ?? "",
        date: format(new Date(transaction.date), "yyyy-MM-dd"),
      });
    } else {
      setForm({
        accountId: "",
        categoryId: "",
        amount: "",
        type: "EXPENSE",
        description: "",
        date: format(new Date(), "yyyy-MM-dd"),
      });
    }
  }, [transaction, open]);

  const filteredCategories = categories.filter((c) => c.type === form.type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = transaction
        ? `/api/finance/transactions/${transaction.id}`
        : "/api/finance/transactions";
      const method = transaction ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      if (!res.ok) throw new Error("Chyba při ukládání");
      toast({ title: transaction ? "Transakce upravena" : "Transakce přidána" });
      onSaved();
      onClose();
    } catch {
      toast({ title: "Chyba", description: "Nepodařilo se uložit transakci", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transaction ? "Upravit transakci" : "Nová transakce"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as "INCOME" | "EXPENSE", categoryId: "" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOME">Příjem</SelectItem>
                  <SelectItem value="EXPENSE">Výdaj</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datum</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Částka (CZK)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Účet</Label>
            <Select
              value={form.accountId}
              onValueChange={(v) => setForm((f) => ({ ...f, accountId: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Vyberte účet" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Kategorie</Label>
            <Select
              value={form.categoryId}
              onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Vyberte kategorii" /></SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Popis (volitelný)</Label>
            <Input
              placeholder="Popis transakce"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Zrušit</Button>
            <Button type="submit" disabled={saving || !form.accountId || !form.categoryId}>
              {saving ? "Ukládám…" : "Uložit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
