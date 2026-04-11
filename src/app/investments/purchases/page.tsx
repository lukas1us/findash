"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

interface Asset { id: string; name: string; ticker: string }
interface Purchase {
  id: string;
  assetId: string;
  date: string;
  quantity: number;
  pricePerUnit: number;
  fees: number;
  notes: string | null;
  asset: { name: string; ticker: string };
}

export default function PurchasesPage() {
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filterAsset, setFilterAsset] = useState("all");
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
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const params = filterAsset !== "all" ? `?assetId=${filterAsset}` : "";
    fetch(`/api/investments/purchases${params}`).then((r) => (r.ok ? r.json() : [])).then(setPurchases).catch(() => {});
  }, [filterAsset]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/investments/assets").then((r) => (r.ok ? r.json() : [])).then(setAssets).catch(() => {});
  }, []);

  function openNew() {
    setEditPurchase(null);
    setForm({ assetId: filterAsset !== "all" ? filterAsset : "", date: format(new Date(), "yyyy-MM-dd"), quantity: "", pricePerUnit: "", fees: "0", notes: "" });
    setFormOpen(true);
  }

  function openEdit(p: Purchase) {
    setEditPurchase(p);
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
          quantity: Number(form.quantity),
          pricePerUnit: Number(form.pricePerUnit),
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

  async function handleDelete(id: string) {
    if (!confirm("Smazat nákup?")) return;
    await fetch(`/api/investments/purchases/${id}`, { method: "DELETE" });
    toast({ title: "Nákup smazán" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nákupy</h1>
          <p className="text-muted-foreground">Historie nákupů investičních aktiv</p>
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
                <TableHead>Aktivum</TableHead>
                <TableHead className="text-right">Množství</TableHead>
                <TableHead className="text-right">Cena/ks</TableHead>
                <TableHead className="text-right">Poplatky</TableHead>
                <TableHead className="text-right">Celkem</TableHead>
                <TableHead>Poznámka</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{formatDate(p.date)}</TableCell>
                  <TableCell className="font-medium">
                    {p.asset.name}
                    <span className="text-xs text-muted-foreground ml-1">({p.asset.ticker})</span>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(p.quantity)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.pricePerUnit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.fees)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(p.quantity * p.pricePerUnit + p.fees)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.notes ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Žádné nákupy
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
            <DialogTitle>{editPurchase ? "Upravit nákup" : "Nový nákup"}</DialogTitle>
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
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
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
    </div>
  );
}
