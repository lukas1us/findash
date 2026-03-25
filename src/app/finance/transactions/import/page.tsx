"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Wallet,
  Info,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type {
  PreviewResult,
  FinancePreviewRow,
  InvestmentPreviewRow,
  ConfirmFinanceRow,
  ConfirmInvestmentRow,
} from "@/lib/csv-parsers/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Account  { id: string; name: string }
interface Category { id: string; name: string; type: string; color: string }
interface Asset    { id: string; name: string; ticker: string }

type Step = 1 | 2 | 3 | 4;

const FORMAT_LABELS: Record<string, string> = {
  airbank:   "Air Bank",
  revolut:   "Revolut",
  coinmate:  "Coinmate",
  cryptocom: "Crypto.com",
  unknown:   "Neznámý",
};

const MODULE_LABELS: Record<string, string> = {
  finance:     "Finance (transakce)",
  investments: "Investice (nákupy)",
};

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDot({ n, current }: { n: number; current: number }) {
  const done    = current > n;
  const active  = current === n;
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium border-2 transition-colors
      ${done   ? "bg-primary border-primary text-primary-foreground" : ""}
      ${active ? "border-primary text-primary" : ""}
      ${!done && !active ? "border-muted-foreground text-muted-foreground" : ""}`}>
      {done ? <CheckCircle2 className="h-4 w-4" /> : n}
    </div>
  );
}

function StepBar({ current }: { current: Step }) {
  const labels = ["Nahrát soubor", "Mapování", "Přehled a import", "Výsledek"];
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <StepDot n={i + 1} current={current} />
            <span className={`text-xs hidden sm:block ${current === i + 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={`h-px w-12 sm:w-24 mb-5 ${current > i + 1 ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const { toast } = useToast();
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const dropRef       = useRef<HTMLDivElement>(null);

  const [step,         setStep]         = useState<Step>(1);
  const [dragging,     setDragging]     = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [importing,    setImporting]    = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview,      setPreview]      = useState<PreviewResult | null>(null);

  // Dropdowns
  const [accounts,    setAccounts]   = useState<Account[]>([]);
  const [categories,  setCategories] = useState<Category[]>([]);
  const [assets,      setAssets]     = useState<Asset[]>([]);

  // Mappings
  const [accountId,    setAccountId]   = useState<string>("");
  const [assetMapping, setAssetMapping] = useState<Record<string, string>>({}); // ticker → assetId
  const [feeCategory,  setFeeCategory] = useState<string>("");

  // Per-row overrides (step 3)
  const [rowCategories, setRowCategories] = useState<Record<number, string>>({});
  const [rowSkipped,    setRowSkipped]    = useState<Record<number, boolean>>({});
  const [defaultCatId,  setDefaultCatId]  = useState<string>("");

  // Step 4
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  // Load reference data
  useEffect(() => {
    fetch("/api/finance/accounts").then((r) => r.json()).then(setAccounts);
    fetch("/api/finance/categories").then((r) => r.json()).then(setCategories);
    fetch("/api/investments/assets").then((r) => r.json()).then(setAssets);
  }, []);

  // Pre-select "Poplatky" category for Revolut fee rows
  useEffect(() => {
    const fee = categories.find((c) => c.name.toLowerCase().includes("poplatek") || c.name.toLowerCase().includes("poplatk"));
    if (fee) setFeeCategory(fee.id);
  }, [categories]);

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Neplatný soubor", description: "Povoleny jsou pouze soubory .csv", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import/preview", { method: "POST", body: fd });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data: PreviewResult = await res.json();
      setPreview(data);

      // Auto-skip duplicates
      const autoSkip: Record<number, boolean> = {};
      [...data.financeRows, ...data.investmentRows].forEach((r) => {
        if (r.isDuplicate) autoSkip[r.rowIndex] = true;
      });
      setRowSkipped(autoSkip);

      // Pre-fill asset mapping from DB: if ticker matches an existing asset
      const mapping: Record<string, string> = {};
      for (const ticker of data.tickers) {
        const asset = assets.find((a) => a.ticker.toUpperCase() === ticker.toUpperCase());
        if (asset) mapping[ticker] = asset.id;
      }
      setAssetMapping(mapping);

      setStep(2);
    } catch (err) {
      toast({ title: "Chyba při parsování", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [assets, toast]);

  // Drag & drop handlers
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const isFinance     = preview?.module === "finance";
  const validRows     = isFinance
    ? preview?.financeRows.filter((r) => !r.parseError) ?? []
    : preview?.investmentRows.filter((r) => !r.parseError) ?? [];

  const dupCount      = validRows.filter((r) => r.isDuplicate).length;
  const errorCount    = preview?.errorCount ?? 0;
  const toImportCount = validRows.filter((r) => !rowSkipped[r.rowIndex]).length;

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");
  const incomeCategories  = categories.filter((c) => c.type === "INCOME");

  function getCatForRow(row: FinancePreviewRow): string {
    if (rowCategories[row.rowIndex]) return rowCategories[row.rowIndex];
    if (row.isFeeRow && feeCategory) return feeCategory;
    return defaultCatId;
  }

  // ── Step 2 validation ─────────────────────────────────────────────────────

  const step2Valid = isFinance
    ? !!accountId
    : preview?.tickers.every((t) => !!assetMapping[t]) ?? false;

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (!preview) return;
    setImporting(true);

    try {
      let body: object;

      if (isFinance) {
        const rows = (preview.financeRows as FinancePreviewRow[])
          .filter((r) => !r.parseError && !rowSkipped[r.rowIndex])
          .map((r): ConfirmFinanceRow => ({
            date:             r.date,
            amount:           r.amount,
            type:             r.type,
            description:      r.description,
            categoryId:       getCatForRow(r),
            externalId:       r.externalId,
            originalCurrency: r.originalCurrency,
            originalAmount:   r.originalAmount,
            exchangeRate:     r.exchangeRate,
          }));

        body = { module: "finance", accountId, financeRows: rows };
      } else {
        const rows = (preview.investmentRows as InvestmentPreviewRow[])
          .filter((r) => !r.parseError && !rowSkipped[r.rowIndex])
          .map((r): ConfirmInvestmentRow => ({
            date:         r.date,
            ticker:       r.ticker,
            assetId:      assetMapping[r.ticker] ?? "",
            quantity:     r.quantity,
            pricePerUnit: r.pricePerUnit,
            fees:         r.fees,
            notes:        r.description,
            externalId:   r.externalId,
          }));

        body = { module: "investments", investmentRows: rows };
      }

      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      setImportResult(result);
      setStep(4);
    } catch (err) {
      toast({ title: "Chyba při importu", description: String(err), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Import CSV</h1>
        <p className="text-muted-foreground">Nahrát výpis z banky nebo kryptoměnové burzy</p>
      </div>

      <StepBar current={step} />

      {/* ── Step 1: Upload ────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            ref={dropRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors
              ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"}`}
          >
            {uploading ? (
              <>
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground">Parsování…</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">Přetáhněte CSV soubor sem</p>
                  <p className="text-sm text-muted-foreground mt-1">nebo klikněte pro výběr souboru</p>
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          <Card className="bg-muted/30">
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2"><Info className="h-4 w-4" /> Podporované formáty</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {[
                  { name: "Air Bank", module: "Finance", note: "výpis účtu (;)" },
                  { name: "Revolut",  module: "Finance", note: "všechny měny (,)" },
                  { name: "Coinmate", module: "Investice", note: "BUY/DEPOSIT (;)" },
                  { name: "Crypto.com", module: "Investice", note: "nákupy (,)" },
                ].map((f) => (
                  <div key={f.name} className="rounded-md border p-3 space-y-1">
                    <p className="font-medium">{f.name}</p>
                    <Badge variant={f.module === "Finance" ? "default" : "secondary"} className="text-xs">
                      {f.module === "Finance" ? <Wallet className="h-3 w-3 mr-1 inline" /> : <TrendingUp className="h-3 w-3 mr-1 inline" />}
                      {f.module}
                    </Badge>
                    <p className="text-xs text-muted-foreground">{f.note}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 2: Mapping & Preview ─────────────────────────────────────── */}
      {step === 2 && preview && (
        <div className="space-y-6">
          {/* Format banner */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 flex items-center gap-4">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="font-medium">
                  Detekován formát: <span className="text-primary">{FORMAT_LABELS[preview.format]}</span>
                  {" · "}
                  Data budou importována do: <span className="text-primary">{MODULE_LABELS[preview.module]}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {validRows.length} platných řádků · {errorCount} chyb · {dupCount} duplikátů
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="space-y-2">
              {preview.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Finance mappings */}
          {isFinance && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Cílový účet *</label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Vyberte účet" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Výchozí kategorie výdajů</label>
                <Select value={defaultCatId} onValueChange={setDefaultCatId}>
                  <SelectTrigger><SelectValue placeholder="Vyberte kategorii…" /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {feeCategory && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kategorie pro poplatky (Revolut)</label>
                  <Select value={feeCategory} onValueChange={setFeeCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Investment asset mapping */}
          {!isFinance && preview.tickers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Mapování tickerů na aktiva *</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {preview.tickers.map((ticker) => (
                  <div key={ticker} className="flex items-center gap-3">
                    <Badge variant="outline" className="w-20 justify-center font-mono">{ticker}</Badge>
                    <Select
                      value={assetMapping[ticker] ?? ""}
                      onValueChange={(v) => setAssetMapping((m) => ({ ...m, [ticker]: v }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Vyberte aktivum…" />
                      </SelectTrigger>
                      <SelectContent>
                        {assets.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name} ({a.ticker})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5-row preview table */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Náhled (prvních 5 řádků)</p>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    {isFinance ? (
                      <>
                        <TableHead>Popis</TableHead>
                        <TableHead className="text-right">Částka</TableHead>
                        <TableHead>Typ</TableHead>
                        {preview.currencies.length > 0 && <TableHead>Kurz ECB</TableHead>}
                      </>
                    ) : (
                      <>
                        <TableHead>Ticker</TableHead>
                        <TableHead className="text-right">Množství</TableHead>
                        <TableHead className="text-right">Cena/ks (CZK)</TableHead>
                      </>
                    )}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isFinance
                    ? (preview.financeRows.filter((r) => !r.parseError).slice(0, 5) as FinancePreviewRow[]).map((r) => (
                        <TableRow key={r.rowIndex} className={r.isDuplicate ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                          <TableCell>{r.date}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{r.description}</TableCell>
                          <TableCell className={`text-right font-medium ${r.type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                            {r.type === "INCOME" ? "+" : "−"}{formatCurrency(r.amount)}
                          </TableCell>
                          <TableCell>{r.type === "INCOME" ? "Příjem" : "Výdaj"}</TableCell>
                          {preview.currencies.length > 0 && (
                            <TableCell className="text-sm">
                              {r.exchangeRate
                                ? <span className="text-muted-foreground">1 {r.originalCurrency} = {r.exchangeRate.toFixed(3)} CZK</span>
                                : r.originalCurrency
                                  ? <span className="text-amber-600">kurz chybí</span>
                                  : "—"
                              }
                            </TableCell>
                          )}
                          <TableCell>
                            {r.isDuplicate
                              ? <Badge variant="outline" className="text-yellow-600 border-yellow-400">Duplikát</Badge>
                              : <Badge variant="secondary">OK</Badge>}
                          </TableCell>
                        </TableRow>
                      ))
                    : (preview.investmentRows.filter((r) => !r.parseError).slice(0, 5) as InvestmentPreviewRow[]).map((r) => (
                        <TableRow key={r.rowIndex} className={r.isDuplicate ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                          <TableCell>{r.date}</TableCell>
                          <TableCell><Badge variant="outline" className="font-mono">{r.ticker}</Badge></TableCell>
                          <TableCell className="text-right">{r.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.pricePerUnit)}</TableCell>
                          <TableCell>
                            {r.isDuplicate
                              ? <Badge variant="outline" className="text-yellow-600 border-yellow-400">Duplikát</Badge>
                              : <Badge variant="secondary">OK</Badge>}
                          </TableCell>
                        </TableRow>
                      ))
                  }
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep(1); setPreview(null); setSelectedFile(null); }}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Zpět
            </Button>
            <Button onClick={() => setStep(3)} disabled={!step2Valid}>
              Pokračovat <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & Import ───────────────────────────────────────── */}
      {step === 3 && preview && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-950/30 text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              K importu: <span className="font-bold">{toImportCount}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Duplikáty (přeskočeny): <span className="font-bold">{dupCount}</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-950/30 text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Chyby: <span className="font-bold">{errorCount}</span>
              </div>
            )}
          </div>

          {/* Full table */}
          <div className="rounded-md border overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      title="Vybrat vše"
                      checked={validRows.every((r) => !rowSkipped[r.rowIndex])}
                      onChange={(e) => {
                        const next: Record<number, boolean> = {};
                        if (!e.target.checked) validRows.forEach((r) => { next[r.rowIndex] = true; });
                        setRowSkipped(next);
                      }}
                    />
                  </TableHead>
                  <TableHead>Datum</TableHead>
                  {isFinance ? (
                    <>
                      <TableHead>Popis</TableHead>
                      <TableHead className="text-right">Částka</TableHead>
                      <TableHead>Kategorie</TableHead>
                      {preview.currencies.length > 0 && <TableHead>Orig. měna</TableHead>}
                    </>
                  ) : (
                    <>
                      <TableHead>Ticker → Aktivum</TableHead>
                      <TableHead className="text-right">Množství</TableHead>
                      <TableHead className="text-right">Cena/ks</TableHead>
                      <TableHead className="text-right">Poplatek</TableHead>
                    </>
                  )}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFinance
                  ? (preview.financeRows as FinancePreviewRow[]).map((r) => {
                      if (r.parseError) {
                        return (
                          <TableRow key={r.rowIndex} className="bg-red-50/50 dark:bg-red-950/10">
                            <TableCell><input type="checkbox" disabled /></TableCell>
                            <TableCell colSpan={99} className="text-destructive text-sm">{r.parseError}</TableCell>
                          </TableRow>
                        );
                      }
                      const skipped = !!rowSkipped[r.rowIndex];
                      const rowCats = r.type === "INCOME" ? incomeCategories : expenseCategories;
                      return (
                        <TableRow
                          key={r.rowIndex}
                          className={`${r.isDuplicate ? "bg-yellow-50 dark:bg-yellow-950/20" : ""} ${skipped ? "opacity-40" : ""}`}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={!skipped}
                              onChange={(e) => setRowSkipped((s) => ({ ...s, [r.rowIndex]: !e.target.checked }))}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.date}</TableCell>
                          <TableCell className="max-w-[180px] truncate text-sm">{r.description}</TableCell>
                          <TableCell className={`text-right font-medium text-sm ${r.type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                            {r.type === "INCOME" ? "+" : "−"}{formatCurrency(r.amount)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={getCatForRow(r)}
                              onValueChange={(v) => setRowCategories((rc) => ({ ...rc, [r.rowIndex]: v }))}
                            >
                              <SelectTrigger className="h-8 text-xs w-36">
                                <SelectValue placeholder="Kategorie…" />
                              </SelectTrigger>
                              <SelectContent>
                                {rowCats.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          {preview.currencies.length > 0 && (
                            <TableCell className="text-xs text-muted-foreground">
                              {r.originalCurrency
                                ? `${r.originalAmount?.toFixed(2)} ${r.originalCurrency}`
                                : "—"}
                            </TableCell>
                          )}
                          <TableCell>
                            {r.isDuplicate
                              ? <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">Duplikát</Badge>
                              : <Badge variant="secondary" className="text-xs">OK</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  : (preview.investmentRows as InvestmentPreviewRow[]).map((r) => {
                      if (r.parseError) {
                        return (
                          <TableRow key={r.rowIndex} className="bg-red-50/50 dark:bg-red-950/10">
                            <TableCell><input type="checkbox" disabled /></TableCell>
                            <TableCell colSpan={99} className="text-destructive text-sm">{r.parseError}</TableCell>
                          </TableRow>
                        );
                      }
                      const skipped = !!rowSkipped[r.rowIndex];
                      const mappedAsset = assets.find((a) => a.id === assetMapping[r.ticker]);
                      return (
                        <TableRow
                          key={r.rowIndex}
                          className={`${r.isDuplicate ? "bg-yellow-50 dark:bg-yellow-950/20" : ""} ${skipped ? "opacity-40" : ""}`}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={!skipped}
                              onChange={(e) => setRowSkipped((s) => ({ ...s, [r.rowIndex]: !e.target.checked }))}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.date}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">{r.ticker}</Badge>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{mappedAsset?.name ?? <span className="text-destructive text-xs">Nemapováno</span>}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">{r.quantity}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(r.pricePerUnit)}</TableCell>
                          <TableCell className="text-right text-sm">{r.fees > 0 ? formatCurrency(r.fees) : "—"}</TableCell>
                          <TableCell>
                            {r.isDuplicate
                              ? <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">Duplikát</Badge>
                              : <Badge variant="secondary" className="text-xs">OK</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })
                }
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Zpět
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || toImportCount === 0}
            >
              {importing ? (
                <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />Importuji…</>
              ) : (
                <>Importovat {toImportCount} řádků <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Result ────────────────────────────────────────────────── */}
      {step === 4 && importResult && (
        <div className="space-y-6 max-w-lg">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Import dokončen</h2>
              <p className="text-muted-foreground mt-1">
                Importováno do: <strong>{preview ? MODULE_LABELS[preview.module] : ""}</strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
                <p className="text-sm text-muted-foreground">Importováno</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-muted-foreground">{importResult.skipped}</p>
                <p className="text-sm text-muted-foreground">Přeskočeno</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-destructive">{importResult.errors.length}</p>
                <p className="text-sm text-muted-foreground">Chyby</p>
              </CardContent>
            </Card>
          </div>

          {importResult.errors.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader><CardTitle className="text-sm text-destructive">Chyby při importu</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {importResult.errors.slice(0, 10).map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{e}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button asChild>
              <Link href={preview?.module === "finance" ? "/finance/transactions" : "/investments/purchases"}>
                Přejít na {preview?.module === "finance" ? "transakce" : "nákupy"}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => {
              setStep(1); setPreview(null); setSelectedFile(null); setImportResult(null);
              setRowSkipped({}); setRowCategories({}); setAccountId(""); setAssetMapping({});
            }}>
              Nový import
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
