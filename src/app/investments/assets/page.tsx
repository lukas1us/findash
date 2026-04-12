"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/lib/i18n/context";

interface Asset {
  id: string;
  name: string;
  ticker: string;
  type: "CRYPTO" | "REAL_ESTATE" | "GOLD_SILVER" | "OTHER";
  currency: string;
  purchases: { quantity: number; pricePerUnit: number; fees: number }[];
  prices: { price: number }[];
  cryptoTransactions: { quantity: number }[];
}

export default function AssetsPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState({ name: "", ticker: "", type: "CRYPTO" as Asset["type"], currency: "CZK" });
  const [saving, setSaving] = useState(false);

  const TYPE_LABELS = useMemo(() => ({
    CRYPTO: t("investments.assets.types.CRYPTO"),
    REAL_ESTATE: t("investments.assets.types.REAL_ESTATE"),
    GOLD_SILVER: t("investments.assets.types.GOLD_SILVER"),
    OTHER: t("investments.assets.types.OTHER"),
  }), [t]);

  const load = useCallback(() => {
    fetch("/api/investments/assets").then((r) => (r.ok ? r.json() : [])).then(setAssets).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditAsset(null);
    setForm({ name: "", ticker: "", type: "CRYPTO", currency: "CZK" });
    setFormOpen(true);
  }

  function openEdit(a: Asset) {
    setEditAsset(a);
    setForm({ name: a.name, ticker: a.ticker, type: a.type, currency: a.currency });
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editAsset) {
        await fetch(`/api/investments/assets/${editAsset.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await fetch("/api/investments/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      toast({ title: t("investments.assets.saved") });
      setFormOpen(false);
      load();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t("investments.assets.deleteConfirm"))) return;
    await fetch(`/api/investments/assets/${id}`, { method: "DELETE" });
    toast({ title: t("investments.assets.deleted") });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("investments.assets.title")}</h1>
          <p className="text-muted-foreground">{t("investments.assets.subtitle")}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> {t("investments.assets.addAsset")}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("investments.assets.name")}</TableHead>
                <TableHead>{t("investments.assets.ticker")}</TableHead>
                <TableHead>{t("investments.assets.type")}</TableHead>
                <TableHead>{t("investments.assets.currency")}</TableHead>
                <TableHead className="text-right">{t("investments.assets.quantity")}</TableHead>
                <TableHead className="text-right">{t("investments.assets.currentPrice")}</TableHead>
                <TableHead className="text-right">{t("investments.assets.value")}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => {
                const qty = a.purchases.reduce((s, p) => s + p.quantity, 0)
                          + a.cryptoTransactions.reduce((s, ct) => s + ct.quantity, 0);
                const currentPrice = a.prices[0]?.price ?? 0;
                const value = qty * currentPrice;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      <Link href={`/investments/assets/${a.id}`} className="hover:underline">
                        {a.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.ticker}</TableCell>
                    <TableCell>{TYPE_LABELS[a.type]}</TableCell>
                    <TableCell>{a.currency}</TableCell>
                    <TableCell className="text-right">{formatNumber(qty)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(currentPrice)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(value)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
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
                    </TableCell>
                  </TableRow>
                );
              })}
              {assets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {t("investments.assets.noAssets")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAsset ? t("investments.assets.editAsset") : t("investments.assets.addAsset")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("investments.assets.name")}</Label>
              <Input
                placeholder="Bitcoin"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("investments.assets.ticker")}</Label>
                <Input
                  placeholder="BTC"
                  value={form.ticker}
                  onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("investments.assets.currency")}</Label>
                <Input
                  placeholder="CZK"
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("investments.assets.type")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as Asset["type"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRYPTO">{TYPE_LABELS.CRYPTO}</SelectItem>
                  <SelectItem value="REAL_ESTATE">{TYPE_LABELS.REAL_ESTATE}</SelectItem>
                  <SelectItem value="GOLD_SILVER">{TYPE_LABELS.GOLD_SILVER}</SelectItem>
                  <SelectItem value="OTHER">{TYPE_LABELS.OTHER}</SelectItem>
                </SelectContent>
              </Select>
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
