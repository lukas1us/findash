"use client";

import { useCallback, useRef, useState } from "react";
import { Button }   from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge }    from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  Upload, FileText, CheckCircle2, AlertTriangle, X, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import type { CryptoFilePreview, CryptoPreviewRow } from "@/lib/crypto-parsers/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  binance:          "Binance",
  coinmate_orders:  "Coinmate Orders",
  coinmate_history: "Coinmate History",
  cryptocom:        "Crypto.com",
  unknown:          "Neznámý formát",
};

const TX_BADGE: Record<string, string> = {
  BUY:        "bg-green-100  text-green-700  dark:bg-green-950/40  dark:text-green-400",
  SELL:       "bg-red-100    text-red-700    dark:bg-red-950/40    dark:text-red-400",
  REWARD:     "bg-blue-100   text-blue-700   dark:bg-blue-950/40   dark:text-blue-400",
  DEPOSIT:    "bg-gray-100   text-gray-700   dark:bg-gray-800      dark:text-gray-300",
  WITHDRAWAL: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  SWAP:       "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
};

type Step = 1 | 2 | 3;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CryptoImportPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step,       setStep]       = useState<Step>(1);
  const [dragging,   setDragging]   = useState(false);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [files,      setFiles]      = useState<File[]>([]);
  const [previews,   setPreviews]   = useState<CryptoFilePreview[]>([]);
  const [skipped,    setSkipped]    = useState<Record<string, boolean>>({}); // "fileIdx:rowIdx" → skip
  const [importResult, setImportResult] = useState<Record<string, { imported: number; skipped: number; errors: string[] }> | null>(null);


  // ── File handling ─────────────────────────────────────────────────────────

  function addFiles(incoming: FileList | File[]) {
    const csvs = Array.from(incoming).filter((f) => f.name.endsWith(".csv"));
    if (!csvs.length) {
      toast({ title: "Pouze .csv soubory", variant: "destructive" });
      return;
    }
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...csvs.filter((f) => !names.has(f.name))];
    });
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleAnalyze = useCallback(async () => {
    if (!files.length) return;
    setAnalyzing(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const res  = await fetch("/api/investments/import/preview", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CryptoFilePreview[] = await res.json();
      setPreviews(data);
      // Auto-skip duplicates
      const autoSkip: Record<string, boolean> = {};
      data.forEach((fp, fi) => fp.rows.forEach((r) => {
        if (r.isDuplicate) autoSkip[`${fi}:${r.rowIndex}`] = true;
      }));
      setSkipped(autoSkip);
      setStep(2);
    } catch (err) {
      toast({ title: "Chyba při analýze", description: String(err), variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [files, toast]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    try {
      const allRows: CryptoPreviewRow[] = [];
      previews.forEach((fp, fi) => {
        fp.rows.forEach((r) => {
          if (!r.parseError && !skipped[`${fi}:${r.rowIndex}`]) allRows.push(r);
        });
      });

      const res = await fetch("/api/investments/import/confirm", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows: allRows, assetMapping: {} }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { summary } = await res.json();
      setImportResult(summary);
      setStep(3);
    } catch (err) {
      toast({ title: "Chyba při importu", description: String(err), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }, [previews, skipped, toast]);

  // ── Totals ────────────────────────────────────────────────────────────────

  const totalToImport = previews.reduce((s, fp, fi) =>
    s + fp.rows.filter((r) => !r.parseError && !skipped[`${fi}:${r.rowIndex}`]).length, 0);
  const totalDups = previews.reduce((s, fp) => s + fp.duplicateCount, 0);
  const totalErrs = previews.reduce((s, fp) => s + fp.errorCount, 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Import krypto transakcí</h1>
        <p className="text-muted-foreground">Nahrát výpisy z Binance, Coinmate nebo Crypto.com</p>
      </div>

      {/* ── Step 1: Upload ───────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors
              ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">Přetáhněte CSV soubory sem (více najednou)</p>
              <p className="text-sm text-muted-foreground mt-1">Binance, Coinmate Orders, Coinmate History, Crypto.com</p>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" multiple className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)} />

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{f.name}</span>
                    <span className="text-xs text-muted-foreground">({(f.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); setFiles((fs) => fs.filter((_, j) => j !== i)); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleAnalyze} disabled={!files.length || analyzing}>
            {analyzing
              ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />Analyzuji…</>
              : <>Analyzovat {files.length > 0 ? `(${files.length} souborů)` : ""}</>}
          </Button>
        </div>
      )}

      {/* ── Step 2: Preview ──────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-950/30 text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />K importu: <strong>{totalToImport}</strong>
            </div>
            {totalDups > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700">
                <AlertTriangle className="h-3.5 w-3.5" />Duplikáty: <strong>{totalDups}</strong>
              </div>
            )}
            {totalErrs > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-950/30 text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" />Chyby: <strong>{totalErrs}</strong>
              </div>
            )}
          </div>

          {/* Per-file preview tables */}
          {previews.map((fp, fi) => (
            <Card key={fi}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">{fp.filename}</CardTitle>
                  <Badge variant="secondary">{FORMAT_LABELS[fp.format] ?? fp.format}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {fp.toImportCount} k importu · {fp.duplicateCount} duplikátů · {fp.errorCount} chyb
                  </span>
                </div>
                {fp.warnings.map((w, wi) => (
                  <div key={wi} className="flex gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1 mt-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />{w}
                  </div>
                ))}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-md border overflow-auto max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <input type="checkbox"
                            checked={fp.rows.filter((r) => !r.parseError).every((r) => !skipped[`${fi}:${r.rowIndex}`])}
                            onChange={(e) => {
                              setSkipped((s) => {
                                const next = { ...s };
                                fp.rows.filter((r) => !r.parseError).forEach((r) => {
                                  if (!e.target.checked) next[`${fi}:${r.rowIndex}`] = true;
                                  else delete next[`${fi}:${r.rowIndex}`];
                                });
                                return next;
                              });
                            }}
                          />
                        </TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Aktivum</TableHead>
                        <TableHead className="text-right">Množství</TableHead>
                        <TableHead className="text-right">Cena/ks</TableHead>
                        <TableHead className="text-right">Celkem CZK</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fp.rows.slice(0, 50).map((r) => {
                        if (r.parseError) {
                          return (
                            <TableRow key={r.rowIndex} className="bg-red-50/50 dark:bg-red-950/10">
                              <TableCell />
                              <TableCell colSpan={7} className="text-destructive text-xs">{r.parseError}</TableCell>
                            </TableRow>
                          );
                        }
                        const key      = `${fi}:${r.rowIndex}`;
                        const isSkip   = !!skipped[key];
                        const isDup    = !!r.isDuplicate;
                        return (
                          <TableRow key={r.rowIndex}
                            className={`${isDup ? "bg-yellow-50 dark:bg-yellow-950/20" : ""} ${isSkip ? "opacity-40" : ""}`}>
                            <TableCell>
                              <input type="checkbox" checked={!isSkip}
                                onChange={(e) => setSkipped((s) => {
                                  const next = { ...s };
                                  if (!e.target.checked) next[key] = true; else delete next[key];
                                  return next;
                                })} />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.date}</TableCell>
                            <TableCell>
                              <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${TX_BADGE[r.type] ?? ""}`}>
                                {r.type}
                              </span>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="font-mono text-xs">{r.ticker}</Badge></TableCell>
                            <TableCell className={`text-right text-xs font-mono ${r.quantity < 0 ? "text-red-600" : "text-green-600"}`}>
                              {r.quantity > 0 ? "+" : ""}{r.quantity}
                            </TableCell>
                            <TableCell className="text-right text-xs">{r.pricePerUnit ? formatCurrency(r.pricePerUnit) : "—"}</TableCell>
                            <TableCell className="text-right text-xs">{r.totalCZK ? formatCurrency(r.totalCZK) : "—"}</TableCell>
                            <TableCell>
                              {isDup
                                ? <span className="text-xs text-yellow-600 font-medium">Duplikát</span>
                                : <span className="text-xs text-muted-foreground">OK</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {fp.rows.length > 50 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-2">
                            … a dalších {fp.rows.length - 50} řádků
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep(1); setPreviews([]); }}>
              Zpět
            </Button>
            <Button onClick={handleImport} disabled={importing || totalToImport === 0}>
              {importing
                ? <><span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />Importuji…</>
                : <>Importovat vše ({totalToImport}) <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Result ───────────────────────────────────────────────── */}
      {step === 3 && importResult && (
        <div className="space-y-6 max-w-lg">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold">Import dokončen</h2>
          </div>

          <div className="space-y-3">
            {Object.entries(importResult).map(([source, s]) => (
              <Card key={source}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{source.replace(/_/g, " ")}</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600 font-medium">importováno: {s.imported}</span>
                      {s.skipped > 0 && <span className="text-muted-foreground">přeskočeno: {s.skipped}</span>}
                      {s.errors.length > 0 && <span className="text-destructive">chyby: {s.errors.length}</span>}
                    </div>
                  </div>
                  {s.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {s.errors.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{e}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-3">
            <Button asChild><Link href="/investments/assets">Přejít na aktiva</Link></Button>
            <Button variant="outline" onClick={() => {
              setStep(1); setFiles([]); setPreviews([]); setSkipped({}); setImportResult(null);
            }}>Nový import</Button>
          </div>
        </div>
      )}
    </div>
  );
}
