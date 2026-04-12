"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Wallet, PiggyBank, Banknote } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/lib/i18n/context";

interface Account {
  id: string;
  name: string;
  type: "CHECKING" | "SAVINGS" | "CASH";
  currency: string;
  balance: number;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  CHECKING: <Wallet className="h-6 w-6" />,
  SAVINGS: <PiggyBank className="h-6 w-6" />,
  CASH: <Banknote className="h-6 w-6" />,
};

export default function AccountsPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [form, setForm] = useState({ name: "", type: "CHECKING" as Account["type"], currency: "CZK", balance: "" });
  const [saving, setSaving] = useState(false);

  const TYPE_LABELS = useMemo(() => ({
    CHECKING: t("finance.accounts.types.CHECKING"),
    SAVINGS: t("finance.accounts.types.SAVINGS"),
    CASH: t("finance.accounts.types.CASH"),
  }), [t]);

  const load = useCallback(() => {
    fetch("/api/finance/accounts").then((r) => (r.ok ? r.json() : [])).then(setAccounts).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditAccount(null);
    setForm({ name: "", type: "CHECKING", currency: "CZK", balance: "" });
    setFormOpen(true);
  }

  function openEdit(a: Account) {
    setEditAccount(a);
    setForm({ name: a.name, type: a.type, currency: a.currency, balance: String(a.balance) });
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editAccount) {
        await fetch(`/api/finance/accounts/${editAccount.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, balance: Number(form.balance) }),
        });
      } else {
        await fetch("/api/finance/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, balance: Number(form.balance) }),
        });
      }
      toast({ title: t("finance.accounts.saved") });
      setFormOpen(false);
      load();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("finance.accounts.deleteConfirm"))) return;
    await fetch(`/api/finance/accounts/${id}`, { method: "DELETE" });
    toast({ title: t("finance.accounts.deleted") });
    load();
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("finance.accounts.title")}</h1>
          <p className="text-muted-foreground">{t("finance.accounts.subtitle")}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> {t("finance.accounts.newAccount")}
        </Button>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">{t("finance.accounts.totalAssets")}</p>
          <p className="text-3xl font-bold">{formatCurrency(totalBalance)}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className="text-muted-foreground">{TYPE_ICONS[a.type]}</div>
                <div>
                  <CardTitle className="text-base">{a.name}</CardTitle>
                  <Badge variant="secondary" className="mt-1 text-xs">{TYPE_LABELS[a.type]}</Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(a)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${a.balance < 0 ? "text-destructive" : ""}`}>
                {formatCurrency(a.balance, a.currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{a.currency}</p>
            </CardContent>
          </Card>
        ))}

        {accounts.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            {t("finance.accounts.noAccounts")}
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAccount ? t("finance.accounts.editAccount") : t("finance.accounts.newAccount")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("finance.accounts.name")}</Label>
              <Input
                placeholder={t("finance.accounts.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("finance.accounts.type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as Account["type"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHECKING">{TYPE_LABELS.CHECKING}</SelectItem>
                  <SelectItem value="SAVINGS">{TYPE_LABELS.SAVINGS}</SelectItem>
                  <SelectItem value="CASH">{TYPE_LABELS.CASH}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("finance.accounts.currency")}</Label>
                <Input
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  placeholder="CZK"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("finance.accounts.initialBalance")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={form.balance}
                  onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
