"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, Gem } from "lucide-react";
import { formatCurrencyPrecise, formatDate } from "@/lib/formatters";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

interface LatestPrice {
  id: string;
  assetId: string;
  price: number;
  source: "MANUAL" | "API";
  fetchedAt: string;
  asset: { id: string; name: string; ticker: string; type: string };
}
interface Asset { id: string; name: string; ticker: string; type: string }

export default function PricesPage() {
  const { toast } = useToast();
  const [prices, setPrices] = useState<LatestPrice[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchingMetals, setFetchingMetals] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/investments/prices").then((r) => (r.ok ? r.json() : [])).then(setPrices).catch(() => {});
    fetch("/api/investments/assets").then((r) => (r.ok ? r.json() : [])).then(setAssets).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAutoFetch() {
    setFetching(true);
    try {
      const res = await fetch("/api/investments/prices/fetch", { method: "POST" });
      const data = await res.json();
      const ok = data.results.filter((r: { price: number | null }) => r.price !== null).length;
      const fail = data.results.filter((r: { price: number | null }) => r.price === null).length;
      toast({
        title: "Ceny aktualizovány",
        description: `${ok} úspěšně, ${fail} selhalo`,
      });
      load();
    } catch {
      toast({ title: "Chyba při načítání cen", variant: "destructive" });
    } finally {
      setFetching(false);
    }
  }

  async function handleMetalsFetch() {
    setFetchingMetals(true);
    try {
      const res = await fetch("/api/investments/prices/metals", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Chyba při načítání cen kovů", description: data.error, variant: "destructive" });
        return;
      }
      if (data.updated.length === 0) {
        toast({ title: "Žádná aktiva ke stažení", description: data.error ?? "V DB není žádné aktivum XAU/XAG" });
        return;
      }
      toast({
        title: "Ceny kovů aktualizovány",
        description: `Aktualizováno: ${data.updated.join(", ")}`,
      });
      load();
    } catch {
      toast({ title: "Chyba při načítání cen kovů", variant: "destructive" });
    } finally {
      setFetchingMetals(false);
    }
  }

  function openManualUpdate(asset: Asset) {
    setSelectedAsset(asset);
    const current = prices.find((p) => p.assetId === asset.id);
    setNewPrice(current ? String(current.price) : "");
    setFormOpen(true);
  }

  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    setSaving(true);
    try {
      await fetch("/api/investments/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selectedAsset.id, price: Number(newPrice), source: "MANUAL" }),
      });
      toast({ title: "Cena aktualizována" });
      setFormOpen(false);
      load();
    } catch {
      toast({ title: "Chyba", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const priceMap = Object.fromEntries(prices.map((p) => [p.assetId, p]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ceny aktiv</h1>
          <p className="text-muted-foreground">Manuální a automatická aktualizace cen</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleMetalsFetch} disabled={fetchingMetals} variant="outline">
            <Gem className={`mr-2 h-4 w-4 ${fetchingMetals ? "animate-spin" : ""}`} />
            {fetchingMetals ? "Načítám…" : "Aktualizovat zlato & stříbro"}
          </Button>
          <Button onClick={handleAutoFetch} disabled={fetching} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
            {fetching ? "Načítám…" : "Auto-fetch krypto"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aktuální ceny</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aktivum</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead className="text-right">Aktuální cena</TableHead>
                <TableHead>Zdroj</TableHead>
                <TableHead>Poslední aktualizace</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((a) => {
                const p = priceMap[a.id];
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.name}
                      <span className="text-xs text-muted-foreground ml-1.5">{a.ticker}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.type}</TableCell>
                    <TableCell className="text-right font-medium">
                      {p ? formatCurrencyPrecise(p.price) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {p && (
                        <Badge variant={p.source === "API" ? "default" : "secondary"}>
                          {p.source === "API" ? "API" : "Manuální"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p ? formatDate(p.fetchedAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openManualUpdate(a)}>
                        <Plus className="mr-1 h-3 w-3" />
                        Aktualizovat
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {assets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Žádná aktiva
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
            <DialogTitle>
              Aktualizace ceny — {selectedAsset?.name} ({selectedAsset?.ticker})
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleManualSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nová cena (CZK)</Label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Zrušit</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Ukládám…" : "Uložit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
