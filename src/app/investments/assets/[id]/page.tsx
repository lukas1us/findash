"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatNumber, formatDate, formatMonth } from "@/lib/formatters";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetStats {
  assetId: string;
  name: string;
  ticker: string;
  currentPrice: number;
  totalQuantity: number;
  avgBuyPrice: number;
  totalInvestedCZK: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  realizedPnL: number;
  txCount: number;
  lastPriceUpdate: string | null;
}

interface CryptoTransaction {
  id: string;
  date: string;
  type: string;
  quantity: number;
  pricePerUnit: number | null;
  totalCZK: number | null;
  fee: number | null;
  feeCurrency: string | null;
  source: string;
  notes: string | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

type TxType = "BUY" | "SELL" | "DEPOSIT" | "WITHDRAWAL" | "REWARD" | "SWAP";

const TYPE_BADGE: Record<TxType, string> = {
  BUY:        "bg-green-500/20 text-green-400 border-green-500/30",
  SELL:       "bg-red-500/20 text-red-400 border-red-500/30",
  REWARD:     "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DEPOSIT:    "bg-slate-500/20 text-slate-400 border-slate-500/30",
  WITHDRAWAL: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  SWAP:       "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const TYPE_LABELS: Record<TxType, string> = {
  BUY:        "Nákup",
  SELL:       "Prodej",
  REWARD:     "Odměna",
  DEPOSIT:    "Vklad",
  WITHDRAWAL: "Výběr",
  SWAP:       "Swap",
};

const TABS = ["Přehled", "Transakce", "Graf"] as const;
type Tab = (typeof TABS)[number];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, positive }: { title: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className={`mt-1 text-2xl font-bold ${positive === true ? "text-green-400" : positive === false ? "text-red-400" : ""}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("Přehled");

  // Stats
  const [stats, setStats] = useState<AssetStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Transactions
  const [txs, setTxs] = useState<CryptoTransaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 50, pages: 0 });
  const [txLoading, setTxLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sortOrder, setSortOrder] = useState<"date_desc" | "date_asc">("date_desc");
  const [page, setPage] = useState(1);

  // Chart data derived from transactions
  const [allTxs, setAllTxs] = useState<CryptoTransaction[]>([]);

  // Load stats
  useEffect(() => {
    setStatsLoading(true);
    fetch(`/api/investments/assets/${id}/stats`)
      .then((r) => r.json())
      .then((d) => { setStats(d); setStatsLoading(false); })
      .catch(() => setStatsLoading(false));
  }, [id]);

  // Load paginated transactions
  const loadTxs = useCallback(() => {
    setTxLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
      sort: sortOrder,
    });
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    fetch(`/api/investments/assets/${id}/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => { setTxs(d.transactions); setPagination(d.pagination); setTxLoading(false); })
      .catch(() => setTxLoading(false));
  }, [id, page, sortOrder, typeFilter]);

  useEffect(() => { loadTxs(); }, [loadTxs]);

  // Load ALL transactions for chart (once, no pagination)
  useEffect(() => {
    fetch(`/api/investments/assets/${id}/transactions?limit=1000&sort=date_asc`)
      .then((r) => r.json())
      .then((d) => setAllTxs(d.transactions));
  }, [id]);

  // ── Chart data ─────────────────────────────────────────────────────────────

  // Monthly buy vs sell volume in CZK
  const monthlyData = (() => {
    const map: Record<string, { month: string; buy: number; sell: number }> = {};
    for (const tx of allTxs) {
      const key = tx.date.slice(0, 7); // YYYY-MM
      if (!map[key]) map[key] = { month: formatMonth(tx.date.slice(0, 10)), buy: 0, sell: 0 };
      const czk = tx.totalCZK ?? (tx.pricePerUnit ? Math.abs(tx.quantity) * tx.pricePerUnit : 0);
      if (tx.type === "BUY") map[key].buy += czk;
      if (tx.type === "SELL") map[key].sell += czk;
    }
    return Object.values(map);
  })();

  // Portfolio value over time (cumulative quantity × current price as proxy)
  // Use avgBuyPrice as a proxy when no price history is available
  const portfolioData = (() => {
    if (!stats) return [];
    let qty = 0;
    return allTxs.map((tx) => {
      qty += tx.quantity; // positive for BUY/DEPOSIT/REWARD, negative for SELL/WITHDRAWAL
      const price = tx.pricePerUnit ?? stats.currentPrice;
      return {
        date: formatDate(tx.date.slice(0, 10)),
        value: Math.max(0, qty * price),
      };
    });
  })();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/investments/assets">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">
            {statsLoading ? "…" : (stats?.name ?? "Aktivum")}
          </h1>
          <p className="text-muted-foreground">{stats?.ticker}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab: Přehled ──────────────────────────────────────────────────────── */}
      {tab === "Přehled" && stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Aktuální cena"
            value={formatCurrency(stats.currentPrice)}
            sub={stats.lastPriceUpdate ? `Aktualizováno ${formatDate(stats.lastPriceUpdate)}` : "Cena není k dispozici"}
          />
          <StatCard
            title="Celkové množství"
            value={formatNumber(stats.totalQuantity)}
            sub={`${stats.txCount} transakcí`}
          />
          <StatCard
            title="Průměrná nákupní cena"
            value={formatCurrency(stats.avgBuyPrice)}
          />
          <StatCard
            title="Celkem investováno"
            value={formatCurrency(stats.totalInvestedCZK)}
          />
          <StatCard
            title="Aktuální hodnota"
            value={formatCurrency(stats.currentValue)}
          />
          <StatCard
            title="Nerealizovaný P&L"
            value={`${stats.unrealizedPnL >= 0 ? "+" : ""}${formatCurrency(stats.unrealizedPnL)}`}
            sub={`${stats.unrealizedPnLPct >= 0 ? "+" : ""}${stats.unrealizedPnLPct.toFixed(1)} %`}
            positive={stats.unrealizedPnL >= 0 ? true : false}
          />
          <StatCard
            title="Realizovaný P&L"
            value={`${stats.realizedPnL >= 0 ? "+" : ""}${formatCurrency(stats.realizedPnL)}`}
            positive={stats.realizedPnL >= 0 ? true : false}
          />
          <Card className="flex items-center justify-center">
            <CardContent className="pt-6 flex flex-col items-center gap-2">
              {stats.unrealizedPnL >= 0
                ? <TrendingUp className="h-8 w-8 text-green-400" />
                : <TrendingDown className="h-8 w-8 text-red-400" />}
              <p className="text-sm text-muted-foreground text-center">
                {stats.unrealizedPnL >= 0 ? "V zisku" : "Ve ztrátě"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      {tab === "Přehled" && statsLoading && (
        <p className="text-muted-foreground text-sm">Načítám…</p>
      )}

      {/* ── Tab: Transakce ────────────────────────────────────────────────────── */}
      {tab === "Transakce" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Všechny typy</SelectItem>
                {(Object.keys(TYPE_LABELS) as TxType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => { setSortOrder(v as typeof sortOrder); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Nejnovější</SelectItem>
                <SelectItem value="date_asc">Nejstarší</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead className="text-right">Množství</TableHead>
                    <TableHead className="text-right">Cena/ks</TableHead>
                    <TableHead className="text-right">Celkem CZK</TableHead>
                    <TableHead className="text-right">Poplatek</TableHead>
                    <TableHead>Zdroj</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Načítám…
                      </TableCell>
                    </TableRow>
                  )}
                  {!txLoading && txs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Žádné transakce
                      </TableCell>
                    </TableRow>
                  )}
                  {!txLoading && txs.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm">{formatDate(tx.date.slice(0, 10))}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${TYPE_BADGE[tx.type as TxType] ?? ""}`}>
                          {TYPE_LABELS[tx.type as TxType] ?? tx.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {tx.quantity > 0 ? "+" : ""}{formatNumber(tx.quantity)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {tx.pricePerUnit != null ? formatCurrency(tx.pricePerUnit) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {tx.totalCZK != null ? formatCurrency(tx.totalCZK) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {tx.fee != null ? `${formatNumber(tx.fee)} ${tx.feeCurrency ?? ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tx.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Celkem {pagination.total} transakcí</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Předchozí
                </Button>
                <span className="flex items-center px-2">
                  {page} / {pagination.pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Další
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Graf ─────────────────────────────────────────────────────────── */}
      {tab === "Graf" && (
        <div className="space-y-6">
          {/* Portfolio value line chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hodnota portfolia (aproximace)</CardTitle>
            </CardHeader>
            <CardContent>
              {portfolioData.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Žádná data</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={portfolioData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatCurrency(v), "Hodnota"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Monthly buy vs sell bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Měsíční objem nákupů / prodejů (CZK)</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Žádná data</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatCurrency(v), name === "buy" ? "Nákup" : "Prodej"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend formatter={(v) => (v === "buy" ? "Nákup" : "Prodej")} />
                    <Bar dataKey="buy" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="sell" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
