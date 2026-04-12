"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useTranslation } from "@/lib/i18n/context";
import { i } from "@/lib/i18n/context";

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
type TabKey = "overview" | "transactions" | "chart";

const TYPE_BADGE: Record<TxType, string> = {
  BUY:        "bg-green-500/20 text-green-400 border-green-500/30",
  SELL:       "bg-red-500/20 text-red-400 border-red-500/30",
  REWARD:     "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DEPOSIT:    "bg-slate-500/20 text-slate-400 border-slate-500/30",
  WITHDRAWAL: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  SWAP:       "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

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
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("overview");

  const TABS: { key: TabKey; label: string }[] = useMemo(() => [
    { key: "overview", label: t("investments.assetDetail.tabs.overview") },
    { key: "transactions", label: t("investments.assetDetail.tabs.transactions") },
    { key: "chart", label: t("investments.assetDetail.tabs.chart") },
  ], [t]);

  const TYPE_LABELS = useMemo((): Record<TxType, string> => ({
    BUY:        t("investments.assetDetail.txTypes.BUY"),
    SELL:       t("investments.assetDetail.txTypes.SELL"),
    REWARD:     t("investments.assetDetail.txTypes.REWARD"),
    DEPOSIT:    t("investments.assetDetail.txTypes.DEPOSIT"),
    WITHDRAWAL: t("investments.assetDetail.txTypes.WITHDRAWAL"),
    SWAP:       t("investments.assetDetail.txTypes.SWAP"),
  }), [t]);

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
      .then((r) => (r.ok ? r.json() : null))
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
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setTxs(d.transactions); setPagination(d.pagination); } setTxLoading(false); })
      .catch(() => setTxLoading(false));
  }, [id, page, sortOrder, typeFilter]);

  useEffect(() => { loadTxs(); }, [loadTxs]);

  // Load ALL transactions for chart (once, no pagination)
  useEffect(() => {
    fetch(`/api/investments/assets/${id}/transactions?limit=1000&sort=date_asc`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAllTxs(d.transactions); })
      .catch(() => {});
  }, [id]);

  // ── Chart data ─────────────────────────────────────────────────────────────

  const monthlyData = (() => {
    const map: Record<string, { month: string; buy: number; sell: number }> = {};
    for (const tx of allTxs) {
      const key = tx.date.slice(0, 7);
      if (!map[key]) map[key] = { month: formatMonth(tx.date.slice(0, 10)), buy: 0, sell: 0 };
      const czk = tx.totalCZK ?? (tx.pricePerUnit ? Math.abs(tx.quantity) * tx.pricePerUnit : 0);
      if (tx.type === "BUY") map[key].buy += czk;
      if (tx.type === "SELL") map[key].sell += czk;
    }
    return Object.values(map);
  })();

  const portfolioData = (() => {
    if (!stats) return [];
    let qty = 0;
    return allTxs.map((tx) => {
      qty += tx.quantity;
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
        {TABS.map((tab_) => (
          <button
            key={tab_.key}
            onClick={() => setTab(tab_.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === tab_.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab_.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ─────────────────────────────────────────────────────── */}
      {tab === "overview" && stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t("investments.assetDetail.currentPrice")}
            value={formatCurrency(stats.currentPrice)}
            sub={stats.lastPriceUpdate ? `${t("investments.assetDetail.updatedAt")} ${formatDate(stats.lastPriceUpdate)}` : t("investments.assetDetail.noPriceAvailable")}
          />
          <StatCard
            title={t("investments.assetDetail.totalQuantity")}
            value={formatNumber(stats.totalQuantity)}
            sub={`${stats.txCount} ${t("investments.assetDetail.transactions")}`}
          />
          <StatCard
            title={t("investments.assetDetail.avgBuyPrice")}
            value={formatCurrency(stats.avgBuyPrice)}
          />
          <StatCard
            title={t("investments.assetDetail.totalInvested")}
            value={formatCurrency(stats.totalInvestedCZK)}
          />
          <StatCard
            title={t("investments.assetDetail.currentValue")}
            value={formatCurrency(stats.currentValue)}
          />
          <StatCard
            title={t("investments.assetDetail.unrealizedPnl")}
            value={`${stats.unrealizedPnL >= 0 ? "+" : ""}${formatCurrency(stats.unrealizedPnL)}`}
            sub={`${stats.unrealizedPnLPct >= 0 ? "+" : ""}${stats.unrealizedPnLPct.toFixed(1)} %`}
            positive={stats.unrealizedPnL >= 0 ? true : false}
          />
          <StatCard
            title={t("investments.assetDetail.realizedPnl")}
            value={`${stats.realizedPnL >= 0 ? "+" : ""}${formatCurrency(stats.realizedPnL)}`}
            positive={stats.realizedPnL >= 0 ? true : false}
          />
          <Card className="flex items-center justify-center">
            <CardContent className="pt-6 flex flex-col items-center gap-2">
              {stats.unrealizedPnL >= 0
                ? <TrendingUp className="h-8 w-8 text-green-400" />
                : <TrendingDown className="h-8 w-8 text-red-400" />}
              <p className="text-sm text-muted-foreground text-center">
                {stats.unrealizedPnL >= 0 ? t("investments.assetDetail.inProfit") : t("investments.assetDetail.inLoss")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      {tab === "overview" && statsLoading && (
        <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
      )}

      {/* ── Tab: Transactions ─────────────────────────────────────────────────── */}
      {tab === "transactions" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("investments.assetDetail.type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("investments.assetDetail.allTypes")}</SelectItem>
                {(Object.keys(TYPE_LABELS) as TxType[]).map((txType) => (
                  <SelectItem key={txType} value={txType}>{TYPE_LABELS[txType]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => { setSortOrder(v as typeof sortOrder); setPage(1); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">{t("investments.assetDetail.newest")}</SelectItem>
                <SelectItem value="date_asc">{t("investments.assetDetail.oldest")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("investments.assetDetail.date")}</TableHead>
                    <TableHead>{t("investments.assetDetail.type")}</TableHead>
                    <TableHead className="text-right">{t("investments.assetDetail.quantity")}</TableHead>
                    <TableHead className="text-right">{t("investments.assetDetail.pricePerUnit")}</TableHead>
                    <TableHead className="text-right">{t("investments.assetDetail.totalCzk")}</TableHead>
                    <TableHead className="text-right">{t("investments.assetDetail.fee")}</TableHead>
                    <TableHead>{t("investments.assetDetail.source")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {t("common.loading")}
                      </TableCell>
                    </TableRow>
                  )}
                  {!txLoading && txs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {t("investments.assetDetail.noTransactions")}
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
              <span>{i(t("investments.assetDetail.totalTransactions"), { n: pagination.total })}</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("investments.assetDetail.previous")}
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
                  {t("investments.assetDetail.next")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Chart ─────────────────────────────────────────────────────────── */}
      {tab === "chart" && (
        <div className="space-y-6">
          {/* Portfolio value line chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("investments.assetDetail.portfolioChartTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {portfolioData.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">{t("common.noData")}</p>
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
                      formatter={(v: number) => [formatCurrency(v), t("investments.assetDetail.chartValue")]}
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
              <CardTitle className="text-base">{t("investments.assetDetail.volumeChartTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">{t("common.noData")}</p>
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
                      formatter={(v: number, name: string) => [formatCurrency(v), name === "buy" ? t("investments.assetDetail.chartBuy") : t("investments.assetDetail.chartSell")]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend formatter={(v) => (v === "buy" ? t("investments.assetDetail.chartBuy") : t("investments.assetDetail.chartSell"))} />
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
