"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/components/ui/use-toast";
import { format, startOfMonth, endOfMonth, parseISO, subMonths } from "date-fns";

interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  month: string;
  category: { id: string; name: string; color: string };
}
interface Category { id: string; name: string; type: string }

function getMonthOptions() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "LLLL yyyy") };
  });
}

export default function BudgetsPage() {
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [spends, setSpends] = useState<Record<string, number>>({});
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [formOpen, setFormOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [form, setForm] = useState({ categoryId: "", amount: "" });
  const [saving, setSaving] = useState(false);
  const monthOptions = getMonthOptions();

  const load = useCallback(async () => {
    const [budgetsData, txData] = await Promise.all([
      fetch(`/api/finance/budgets?month=${month}`).then((r) => r.json()),
      fetch(`/api/finance/transactions?month=${month}&type=EXPENSE`).then((r) => r.json()),
    ]);
    setBudgets(budgetsData);

    // Sum spend per category
    const s: Record<string, number> = {};
    for (const tx of txData) {
      s[tx.categoryId] = (s[tx.categoryId] ?? 0) + tx.amount;
    }
    setSpends(s);
  }, [month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/finance/categories")
      .then((r) => r.json())
      .then((cats: Category[]) => setCategories(cats.filter((c) => c.type === "EXPENSE")));
  }, []);

  function openNew() {
    setEditBudget(null);
    setForm({ categoryId: "", amount: "" });
    setFormOpen(true);
  }
  function openEdit(b: Budget) {
    setEditBudget(b);
    setForm({ categoryId: b.categoryId, amount: String(b.amount) });
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editBudget) {
        await fetch(`/api/finance/budgets/${editBudget.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: Number(form.amount) }),
        });
      } else {
        await fetch("/api/finance/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId: form.categoryId, amount: Number(form.amount), month }),
        });
      }
      toast({ title: "Rozpočet uložen" });
      setFormOpen(false);
      load();
    } catch {
      toast({ title: "Chyba", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Smazat rozpočet?")) return;
    await fetch(`/api/finance/budgets/${id}`, { method: "DELETE" });
    toast({ title: "Rozpočet smazán" });
    load();
  }

  const usedCategoryIds = new Set(budgets.map((b) => b.categoryId));
  const availableCategories = editBudget
    ? categories
    : categories.filter((c) => !usedCategoryIds.has(c.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rozpočty</h1>
          <p className="text-muted-foreground">Limity výdajů dle kategorií</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Nový rozpočet
        </Button>
      </div>

      <Select value={month} onValueChange={setMonth}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {budgets.map((b) => {
          const spent = spends[b.categoryId] ?? 0;
          const pct = Math.min((spent / b.amount) * 100, 100);
          const over = spent > b.amount;
          return (
            <Card key={b.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: b.category.color }}
                  />
                  <CardTitle className="text-sm font-semibold">{b.category.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(b)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(b.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className={over ? "text-destructive font-medium" : "text-muted-foreground"}>
                    Utraceno: {formatCurrency(spent)}
                  </span>
                  <span className="text-muted-foreground">Limit: {formatCurrency(b.amount)}</span>
                </div>
                <Progress
                  value={pct}
                  className={over ? "[&>div]:bg-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {over ? (
                    <span className="text-destructive">Překročeno o {formatCurrency(spent - b.amount)}</span>
                  ) : (
                    <span>Zbývá {formatCurrency(b.amount - spent)}</span>
                  )}
                </p>
              </CardContent>
            </Card>
          );
        })}

        {budgets.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            Žádné rozpočty pro tento měsíc
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editBudget ? "Upravit rozpočet" : "Nový rozpočet"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {!editBudget && (
              <div className="space-y-2">
                <Label>Kategorie</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Vyberte kategorii" /></SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Limit (CZK)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Zrušit</Button>
              <Button type="submit" disabled={saving || (!editBudget && !form.categoryId)}>
                {saving ? "Ukládám…" : "Uložit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
