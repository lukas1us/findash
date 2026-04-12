"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, Gem } from "lucide-react";
import { formatCurrencyPrecise, formatDate } from "@/lib/formatters";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { useTranslation } from "@/lib/i18n/context";
import { i } from "@/lib/i18n/context";

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
  const { t } = useTranslation();
  const [prices, setPrices] = useState<LatestPrice[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchingMetals, setFetchingMetals] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [priceUnit, setPriceUnit] = useState<"oz" | "g" | "kg">("oz");
  const [saving, setSaving] = useState(false);

  const G_PER_OZ = 31.1035;
  function toCzkPerOz(price: number, unit: "oz" | "g" | "kg"): number {
    if (unit === "g")  return price * G_PER_OZ;
    if (unit === "kg") return price / 1000 * G_PER_OZ;
    return price;
  }

  const isGoldSilver = selectedAsset?.type === "GOLD_SILVER";

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
        title: t("investments.prices.pricesUpdated"),
        description: i(t("investments.prices.pricesUpdateDesc"), { ok, fail }),
      });
      load();
    } catch {
      toast({ title: t("investments.prices.fetchError"), variant: "destructive" });
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
        toast({ title: t("investments.prices.metalsFetchError"), description: data.error, variant: "destructive" });
        return;
      }
      if (data.updated.length === 0) {
        toast({ title: t("investments.prices.noMetalsAssets"), description: data.error ?? t("investments.prices.noMetalsAssets") });
        return;
      }
      toast({
        title: t("investments.prices.metalsUpdated"),
        description: i(t("investments.prices.metalsUpdatedDesc"), { assets: data.updated.join(", ") }),
      });
      load();
    } catch {
      toast({ title: t("investments.prices.metalsFetchError"), variant: "destructive" });
    } finally {
      setFetchingMetals(false);
    }
  }

  function openManualUpdate(asset: Asset) {
    setSelectedAsset(asset);
    setPriceUnit("oz");
    setNewPrice("");
    setFormOpen(true);
  }

  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    setSaving(true);
    try {
      const priceToStore = isGoldSilver
        ? toCzkPerOz(Number(newPrice), priceUnit)
        : Number(newPrice);

      const res = await fetch("/api/investments/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          price: priceToStore,
          date: new Date().toISOString(),
          source: "MANUAL",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: t("investments.prices.saveError"), description: data.error ?? `HTTP ${res.status}`, variant: "destructive" });
        return;
      }
      toast({ title: t("investments.prices.priceUpdated") });
      setFormOpen(false);
      load();
    } catch {
      toast({ title: t("investments.prices.saveError"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const priceMap = Object.fromEntries(prices.map((p) => [p.assetId, p]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("investments.prices.title")}</h1>
          <p className="text-muted-foreground">{t("investments.prices.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleMetalsFetch} disabled={fetchingMetals} variant="outline">
            <Gem className={`mr-2 h-4 w-4 ${fetchingMetals ? "animate-spin" : ""}`} />
            {fetchingMetals ? t("common.loading") : t("investments.prices.updateMetals")}
          </Button>
          <Button onClick={handleAutoFetch} disabled={fetching} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
            {fetching ? t("common.loading") : t("investments.prices.fetchCrypto")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("investments.prices.currentPrices")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("investments.prices.asset")}</TableHead>
                <TableHead>{t("investments.prices.type")}</TableHead>
                <TableHead className="text-right">{t("investments.prices.currentPrice")}</TableHead>
                <TableHead>{t("investments.prices.source")}</TableHead>
                <TableHead>{t("investments.prices.lastUpdate")}</TableHead>
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
                          {p.source === "API" ? t("common.apiSource") : t("common.manualSource")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p ? formatDate(p.fetchedAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openManualUpdate(a)}>
                        <Plus className="mr-1 h-3 w-3" />
                        {t("investments.prices.updateButton")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {assets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {t("investments.prices.noAssets")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {i(t("investments.prices.manualUpdateTitle"), { name: selectedAsset?.name ?? "", ticker: selectedAsset?.ticker ?? "" })}
            </DialogTitle>
            <DialogDescription>
              {t("investments.prices.manualUpdateDesc")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleManualSave} className="space-y-4">
            <div className="space-y-2">
              <Label>
                {i(t("investments.prices.newPrice"), { unit: isGoldSilver ? `/${priceUnit}` : "" })}
              </Label>
              <div className="flex gap-2">
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
                {isGoldSilver && (
                  <Select value={priceUnit} onValueChange={(v) => setPriceUnit(v as "oz" | "g" | "kg")}>
                    <SelectTrigger className="w-20 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oz">oz</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                    </SelectContent>
                  </Select>
                )}
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
