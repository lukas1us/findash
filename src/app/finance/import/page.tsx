"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

interface Account {
  id: string;
  name: string;
}

type BankFormat = "airbank" | "revolut" | "generic";


type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

type FileType = "csv" | "pdf";

export default function FinanceImportPage() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [bank, setBank] = useState<BankFormat>("airbank");
  const [fileType, setFileType] = useState<FileType>("pdf");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const BANK_LABELS = useMemo((): Record<BankFormat, string> => ({
    airbank: "Air Bank",
    revolut: "Revolut",
    generic: t("finance.importPage.genericFormat"),
  }), [t]);

  useEffect(() => {
    fetch("/api/finance/accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAccounts)
      .catch(() => {});
  }, []);

  async function handleImport() {
    if (!selectedFile || !accountId) return;

    setImporting(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("accountId", accountId);

      const endpoint =
        fileType === "pdf" ? "/api/finance/import-pdf" : "/api/finance/import";

      if (fileType === "csv") {
        formData.append("bank", bank);
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `${t("common.error")} ${res.status}`);
        return;
      }

      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setImporting(false);
    }
  }

  const canImport = !!selectedFile && !!accountId && !importing;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold">{t("finance.importPage.title")}</h1>
        <p className="text-muted-foreground">
          {t("finance.importPage.subtitle")}
        </p>
      </div>

      <div className="space-y-4">
        {/* File type toggle */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Typ souboru</label>
          <div className="flex rounded-md border overflow-hidden">
            {(["pdf", "csv"] as FileType[]).map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => { setFileType(ft); setSelectedFile(null); setResult(null); setError(null); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors
                  ${fileType === ft
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent"
                  }`}
              >
                {ft.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Bank selector — only for CSV */}
        {fileType === "csv" && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("finance.importPage.bankFormat")}</label>
            <Select value={bank} onValueChange={(v) => setBank(v as BankFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BANK_LABELS) as BankFormat[]).map((b) => (
                  <SelectItem key={b} value={b}>
                    {BANK_LABELS[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Account selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("finance.transactionImport.targetAccount")}</label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder={t("finance.transactionImport.selectAccount") + "…"} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* File drop zone */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{fileType === "pdf" ? "PDF soubor" : "CSV soubor"}</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) { setSelectedFile(f); setResult(null); setError(null); }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors
              ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent/30"}`}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            {selectedFile ? (
              <p className="text-sm font-medium">{selectedFile.name}</p>
            ) : (
              <div className="text-center">
                <p className="text-sm font-medium">{t("finance.importPage.dragHere")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("finance.importPage.clickToSelect")}</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={fileType === "pdf" ? ".pdf" : ".csv"}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setSelectedFile(f); setResult(null); setError(null); }
            }}
          />
        </div>

        <Button
          onClick={handleImport}
          disabled={!canImport}
          className="w-full"
        >
          {importing ? (
            <>
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
              Importuji…
            </>
          ) : (
            t("finance.transactionImport.importButton")
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 flex items-start gap-2 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/10">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {t("finance.transactionImport.importResult")}
            </div>
            <p className="text-sm">
              {t("finance.transactionImport.resultImported")} <strong>{result.imported}</strong>,{" "}
              {t("finance.transactionImport.resultSkipped")} <strong>{result.skipped}</strong>
            </p>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {result.errors.length} {t("finance.transactionImport.resultErrors")}:
                </p>
                {result.errors.slice(0, 5).map((e, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground">{e}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
