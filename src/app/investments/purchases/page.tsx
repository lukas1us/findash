"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, TrendingDown } from "lucide-react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

type WeightUnit = "oz" | "g" | "kg";

const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = { oz: "oz", g: "g", kg: "kg" };

const G_PER_OZ = 31.1035;
function toOz(qty: number, unit: WeightUnit): number {
  if (unit === "g")  return qty / G_PER_OZ;
  if (unit === "kg") return (qty * 1000) / G_PER_OZ;
  return qty;
}
function pricePerOz(pricePerUnit: number, unit: WeightUnit): number {
  if (unit === "g")  return pricePerUnit * G_PER_OZ;
  if (unit === "kg") return pricePerUnit / 1000 * G_PER_OZ;
  return pricePerUnit;
}

interface Asset { id: string; name: string; ticker: string; type: string }
interface Account { id: string; name: string; type: string; currency: string }
interface Purchase {
  id: string;
  assetId: string;
  type: "BUY" | "SELL";
  date: string;
  quantity: number;
  pricePerUnit: number;
  fees: number;
  notes: string | null;
  accountId: string | null;
  asset: { name: string; ticker: string };
}

export default function PurchasesPage() {
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filterAsset, setFilterAsset] = useState("all");

  // Buy/edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null);
  const [form, setForm] = useState({
    assetId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    quantity: "",
    pricePerUnit: "",
    fees: "0",
    notes: "",
  });
  const [unit, setUnit] = useState<WeightUnit>("oz");
  const [saving, setSaving] = useState(false);

  // Sell dialog
  const [sellOpen, setSellOpen] = useState(false);
  const [sellAsset, setSellAsset] = useState<Asset | null>(null);
  const [sellForm, setSellForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    quantity: "",
    pricePerUnit: "",
    fees: "0",
    notes: "",
    accountId: "",
  });
  const [sellSaving, setSellSaving] = useState(false);

  const selectedAsset = assets.find((a) => a.id === form.assetId);
  const isGoldSilver = selectedAsset?.type === "GOLD_SILVER";

  const load = useCallback(() => {
    const params = filterAsset !== "all" ? `?assetId=${filterAsset}` : "";
    fetch(`/api/investments/purchases${params}`).then((r) => (r.ok ? r.json() : [])).then(setPurchases).catch(() => {});
  }, [filterAsset]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/investments/assets").then((r) => (r.ok ? r.json() : [])).then(setAssets).catch(() => {});
    fetch("/api/finance/accounts").then((r) => (r.ok ? r.json() : [])).then(setAccounts).catch(() => {});
  }, []);

  function openNew() {
    setEditPurchase(null);
    setUnit("oz");
    setForm({ assetId: filterAsset !== "all" ? filterAsset : "", date: format(new Date(), "yyyy-MM-dd"), quantity: "", pricePerUnit: "", fees: "0", notes: "" });
    setFormOpen(true);
  }

  function openEdit(p: Purchase) {
    setEditPurchase(p);
    setUnit("oz");
    setForm({
      assetId: p.assetId,
      date: format(new Date(p.date), "yyyy-MM-dd"),
      quantity: String(p.quantity),
      pricePerUnit: String(p.pricePerUnit),
      fees: String(p.fees),
      notes: p.notes ?? "",
    });
    setFormOpen(true);
  }

  async function openSell(p: Purchase) {
    const asset = assets.find((a) => a.id === p.assetId) ?? null;
    setSellAsset(asset);

    // Try to pre-fill current price from the asset's latest price
    let currentPrice = "";
    try {
      const r = await fetch(`/api/investments/assets/${p.assetId}/stats`);
      if (r.ok) {
        const stats = await r.json();
        if (stats.currentPrice) currentPrice = String(stats.currentPrice);
      }
    } catch { /* ignore */ }

    setSellForm({
      date: format(new Date(), "yyyy-MM-dd"),
      quantity: String(p.quantity),
      pricePerUnit: currentPrice,
      fees: "0",
      notes: "",
      accountId: "",
    });
    setSellOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editPurchase
        ? `/api/investments/purchases/${editPurchase.id}`
        : "/api/investments/purchases";
      await fetch(url, {
        method: editPurchase ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantity: isGoldSilver && !editPurchase
            ? toOz(Number(form.quantity), unit)
            : Number(form.quantity),
          pricePerUnit: isGoldSilver && !editPurchase
            ? pricePerOz(Number(form.pricePerUnit), unit)
            : Number(form.pricePerUnit),
          fees: Number(form.fees),
        }),
      });
      toast({ title: "Nákup uložen" });
      setFormOpen(false);
      load();
    } catch {
      toast({ title: "Chyba", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSell(e: React.FormEvent) {
    e.preventDefault();
    if (!sellAsset) return;
    setSellSaving(true);
    try {
      const res = await fetch("/api/investments/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: sellAsset.id,
          type: "SELL",
          date: sellForm.date,
          quantity: Number(sellForm.quantity),
          pricePerUnit: Number(sellForm.pricePerUnit),
          fees: Number(sellForm.fees),
          notes: sellForm.notes || null,
          accountId: sellForm.accountId || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Prodej zaznamenán" });
      setSellOpen(false);
      load();
    } catch {
      toast({ title: "Chyba při prodeji", variant: "destructive" });
    } finally {
      setSellSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Smazat záznam?")) return;
    await fetch(`/api/investments/purchases/${id}`, { method: "DELETE" });
    toast({ title: "Záznam smazán" });
    load();
  }

  const sellProceeds =
    Number(sellForm.quantity) * Number(sellForm.pricePerUnit) - Number(sellForm.fees || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nákupy</h1>
          <p className="text-muted-foreground">Historie nákupů a prodejů investičních aktiv</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Nový nákup
        </Button>
      </div>

      <Select value={filterAsset} onValueChange={setFilterAsset}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Filtr dle aktiva" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Všechna aktiva</SelectItem>
          {assets.map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.name} ({a.ticker})</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="pt-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Aktivum</TableHead>
                <TableHead className="text-right">Množství</TableHead>
                <TableHead className="text-right">Cena/ks</TableHead>
                <TableHead className="text-right">Poplatky</TableHead>
                <TableHead className="text-right">Celkem</TableHead>
                <TableHead>Poznámka</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{formatDate(p.date)}</TableCell>
                  <TableCell>
                    <Badge variant={p.type === "SELL" ? "destructive" : "secondary"}>
                      {p.type === "SELL" ? "Prodej" : "Nákup"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.asset.name}
                    <span className="text-xs text-muted-foreground ml-1">({p.asset.ticker})</span>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(p.quantity)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.pricePerUnit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.fees)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {p.type === "SELL"
                      ? <span className="text-green-600">+{formatCurrency(p.quantity * p.pricePerUnit - p.fees)}</span>
                      : formatCurrency(p.quantity * p.pricePerUnit + p.fees)
                    }
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.notes ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      {p.type === "BUY" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-600 hover:text-green-700"
                          title="Prodat"
                          onClick={() => openSell(p)}
                        >
                          <TrendingDown className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {purchases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Žádné záznamy
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Buy / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPurchase ? "Upravit záznam" : "Nový nákup"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Aktivum</Label>
              <Select
                value={form.assetId}
                onValueChange={(v) => setForm((f) => ({ ...f, assetId: v }))}
                disabled={!!editPurchase}
              >
                <SelectTrigger><SelectValue placeholder="Vyberte aktivum" /></SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.ticker})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datum nákupu</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Množství</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    required
                  />
                  {isGoldSilver && !editPurchase && (
                    <Select value={unit} onValueChange={(v) => setUnit(v as WeightUnit)}>
                      <SelectTrigger className="w-20 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(WEIGHT_UNIT_LABELS) as WeightUnit[]).map((u) => (
                          <SelectItem key={u} value={u}>{WEIGHT_UNIT_LABELS[u]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Cena/ks (CZK{isGoldSilver && !editPurchase ? `/${unit}` : ""})
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={form.pricePerUnit}
                  onChange={(e) => setForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Poplatky (CZK)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={form.fees}
                  onChange={(e) => setForm((f) => ({ ...f, fees: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Poznámka (volitelná)</Label>
              <Textarea
                placeholder="Poznámka k nákupu"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Zrušit</Button>
              <Button type="submit" disabled={saving || !form.assetId}>
                {saving ? "Ukládám…" : "Uložit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sell dialog */}
      <Dialog open={sellOpen} onOpenChange={setSellOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Prodat — {sellAsset?.name} ({sellAsset?.ticker})
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSell} className="space-y-4">
            <div className="space-y-2">
              <Label>Datum prodeje</Label>
              <Input
                type="date"
                value={sellForm.date}
                onChange={(e) => setSellForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Množství</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={sellForm.quantity}
                  onChange={(e) => setSellForm((f) => ({ ...f, quantity: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Cena/ks (CZK)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={sellForm.pricePerUnit}
                  onChange={(e) => setSellForm((f) => ({ ...f, pricePerUnit: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Poplatky (CZK)</Label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={sellForm.fees}
                  onChange={(e) => setSellForm((f) => ({ ...f, fees: e.target.value }))}
                />
              </div>
            </div>

            {sellForm.quantity && sellForm.pricePerUnit && (
              <p className="text-sm text-muted-foreground">
                Výnos z prodeje:{" "}
                <span className="font-medium text-green-600">{formatCurrency(sellProceeds)}</span>
              </p>
            )}

            <div className="space-y-2">
              <Label>Přidat výnos na účet (volitelné)</Label>
              <Select
                value={sellForm.accountId}
                onValueChange={(v) => setSellForm((f) => ({ ...f, accountId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nevybráno — pouze zaznamenat prodej" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Poznámka (volitelná)</Label>
              <Textarea
                placeholder="Poznámka k prodeji"
                value={sellForm.notes}
                onChange={(e) => setSellForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSellOpen(false)}>Zrušit</Button>
              <Button type="submit" disabled={sellSaving} variant="destructive">
                {sellSaving ? "Ukládám…" : "Prodat"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
