import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Category, PartsAnalytics } from "@shared/types";
import { Loading } from "../components/ui/Loading";
import { apiClient } from "../lib/api-client";
import { formatPrice } from "../lib/format";

// カテゴリ/メーカー/保管場所などの横棒に割り当てる配色パレット。
const CHART_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#06b6d4", "#a855f7",
];

// 依存を増やさず CSS だけで描く横棒。最大値に対する相対幅で表示する。色未指定時はテーマ色。
function BarRow({ label, value, max, hint, to, color }: { label: string; value: number; max: number; hint?: string; to?: string; color?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  const labelNode = to ? (
    <Link to={to} className="truncate text-app-link hover:underline" title={label}>{label}</Link>
  ) : (
    <span className="truncate" title={label}>{label}</span>
  );
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs">
      {labelNode}
      <div className="h-3 w-full overflow-hidden rounded bg-app-soft">
        <div
          className={`h-full rounded ${color ? "" : "bg-app-link/70"}`}
          style={{ width: `${pct}%`, ...(color ? { backgroundColor: color } : {}) }}
        />
      </div>
      <span className="whitespace-nowrap tabular-nums text-slate-600">{hint ?? value.toLocaleString()}</span>
    </div>
  );
}

function StatusBarRow({
  status,
  max,
}: {
  status: PartsAnalytics["byStatus"][number];
  max: number;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((status.count / max) * 100)) : 0;
  const link = status.id ? `/parts?statusId=${status.id}` : undefined;
  const label = (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
      <span className="truncate" title={status.name}>{status.name}</span>
    </span>
  );
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs">
      {link ? <Link to={link} className="min-w-0 text-app-link hover:underline">{label}</Link> : <span className="min-w-0">{label}</span>}
      <div className="h-3 w-full overflow-hidden rounded bg-slate-100">
        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: status.color }} />
      </div>
      <span
        className="max-w-[8rem] truncate text-right tabular-nums text-slate-600 sm:max-w-none"
        title={`${status.count.toLocaleString()}件 / ${status.stock.toLocaleString()}個 / ${formatPrice(status.value)}`}
      >
        {status.count.toLocaleString()}件 / {status.stock.toLocaleString()}個 / {formatPrice(status.value)}
      </span>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="panel-card p-3">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

// 依存を増やさず SVG だけで描く折れ線グラフ。x は等間隔、y は最大値基準。
function LineChart({ points, color = "#6366f1" }: { points: { label: string; value: number }[]; color?: string }) {
  if (points.length === 0) return <p className="text-xs text-slate-500">データがありません。</p>;
  const W = 600;
  const H = 170;
  const padX = 26;
  const padTop = 18;
  const padBottom = 26;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const px = (i: number) => padX + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const py = (v: number) => padTop + innerH - (v / max) * innerH;
  const polyline = points.map((p, i) => `${px(i)},${py(p.value)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="登録推移グラフ">
      <line x1={padX} y1={padTop + innerH} x2={W - padX} y2={padTop + innerH} stroke="#e2e8f0" strokeWidth={1} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          <circle cx={px(i)} cy={py(p.value)} r={3.5} fill={color}>
            <title>{`${p.label}: ${p.value}件`}</title>
          </circle>
          {p.value > 0 && (
            <text x={px(i)} y={py(p.value) - 7} textAnchor="middle" fontSize={11} fill="#475569">{p.value}</text>
          )}
          <text x={px(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#94a3b8">{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<PartsAnalytics | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [trendUnit, setTrendUnit] = useState<"month" | "year">("month");
  const [trendYear, setTrendYear] = useState("");

  const selectedCategoryId = searchParams.get("categoryId") ?? "";

  useEffect(() => {
    apiClient.listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError("");
    const next = new URLSearchParams();
    if (selectedCategoryId) next.set("categoryId", selectedCategoryId);
    apiClient
      .getPartsAnalytics(next)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "分析データの取得に失敗しました。"))
      .finally(() => setIsLoading(false));
  }, [selectedCategoryId]);

  const maxCategoryCount = useMemo(() => Math.max(1, ...(data?.byCategory.map((c) => c.count) ?? [0])), [data]);
  const maxStatus = useMemo(() => Math.max(1, ...(data?.byStatus.map((s) => s.count) ?? [0])), [data]);
  const maxManufacturer = useMemo(() => Math.max(1, ...(data?.byManufacturer.map((m) => m.count) ?? [0])), [data]);
  const maxLocation = useMemo(() => Math.max(1, ...(data?.byLocation.map((l) => l.count) ?? [0])), [data]);
  // 月別表示で選べる年（データのある年を新しい順に）。
  const trendYears = useMemo(() => {
    const years = new Set<string>();
    for (const m of data?.monthlyAdditions ?? []) years.add(m.month.slice(0, 4));
    return [...years].sort().reverse();
  }, [data]);
  // 未選択や存在しない年は最新年にフォールバック（state更新の副作用を使わず導出）。
  const effectiveYear = trendYears.includes(trendYear) ? trendYear : (trendYears[0] ?? "");
  const trendPoints = useMemo(() => {
    if (!data) return [] as { label: string; value: number }[];
    if (trendUnit === "year") return data.yearlyAdditions.map((y) => ({ label: y.year, value: y.count }));
    // 月別は選択年の1〜12月を0埋めで並べる。
    return Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, "0");
      const found = data.monthlyAdditions.find((m) => m.month === `${effectiveYear}-${mm}`);
      return { label: `${i + 1}`, value: found?.count ?? 0 };
    });
  }, [data, trendUnit, effectiveYear]);

  function updateCategory(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("categoryId", value);
    else next.delete("categoryId");
    setSearchParams(next);
  }

  const health = data?.stockHealth;
  const healthTotal = health ? health.healthy + health.low + health.out : 0;

  return (
    <div className="grid gap-3">
      <section className="panel-card border-b border-slate-200 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-950">統計・分析</h1>
            <span className="rounded bg-app-link/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-app-link">Beta</span>
          </div>
          <div className="flex items-center gap-2">
            <select className="h-8 rounded border border-slate-300 px-2 text-xs" value={selectedCategoryId} onChange={(e) => updateCategory(e.target.value)}>
              <option value="">全カテゴリ</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <Link to="/parts" className="btn">一覧へ</Link>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">アクティブな部品（アーカイブ除く）を集計しています。単価未設定の部品は0円として扱います。</p>
      </section>

      {error && <div className="rounded border border-app bg-app-soft px-3 py-2 text-sm text-app-danger">{error}</div>}

      {isLoading || !data ? (
        <Loading />
      ) : data.totals.count === 0 ? (
        <div className="panel-card p-10 text-center text-sm text-slate-500">集計対象の部品がありません。</div>
      ) : (
        <>
          {/* サマリ */}
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="panel-card p-3">
              <p className="text-[11px] text-slate-500">総在庫価格</p>
              <p className="text-lg font-bold text-slate-900">{formatPrice(data.totals.totalValue)}</p>
              <p className="text-[11px] text-slate-400">単価あり {data.totals.valuedCount.toLocaleString()} / {data.totals.count.toLocaleString()}件</p>
            </div>
            <div className="panel-card p-3">
              <p className="text-[11px] text-slate-500">総在庫数</p>
              <p className="text-lg font-bold text-slate-900">{data.totals.totalStock.toLocaleString()}</p>
            </div>
            <div className="panel-card p-3">
              <p className="text-[11px] text-slate-500">部品点数</p>
              <p className="text-lg font-bold text-slate-900">{data.totals.count.toLocaleString()}</p>
            </div>
            <div className="panel-card p-3">
              <p className="text-[11px] text-slate-500">平均単価（単価ありのみ）</p>
              <p className="text-lg font-bold text-slate-900">
                {data.totals.valuedCount > 0 ? formatPrice(data.totals.totalValue / Math.max(1, data.totals.totalStock)) : "-"}
              </p>
              <p className="text-[11px] text-slate-400">在庫1点あたりの平均</p>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* 在庫健全性 */}
            <Panel title="在庫の健全性" subtitle="しきい値を基準にした在庫状況の内訳">
              {healthTotal > 0 && (
                <div className="mb-2 flex h-3 w-full overflow-hidden rounded">
                  <div className="h-full bg-emerald-400" style={{ width: `${(health!.healthy / healthTotal) * 100}%` }} title={`適正 ${health!.healthy}`} />
                  <div className="h-full bg-amber-400" style={{ width: `${(health!.low / healthTotal) * 100}%` }} title={`低在庫 ${health!.low}`} />
                  <div className="h-full bg-rose-400" style={{ width: `${(health!.out / healthTotal) * 100}%` }} title={`在庫切れ ${health!.out}`} />
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-emerald-50 p-2"><p className="font-bold text-emerald-700">{health!.healthy.toLocaleString()}</p><p className="text-slate-500">適正</p></div>
                <Link to="/parts?stockStatus=low_stock" className="rounded bg-amber-50 p-2 hover:ring-1 hover:ring-amber-300"><p className="font-bold text-amber-700">{health!.low.toLocaleString()}</p><p className="text-slate-500">低在庫</p></Link>
                <Link to="/parts?stockStatus=out_of_stock" className="rounded bg-rose-50 p-2 hover:ring-1 hover:ring-rose-300"><p className="font-bold text-rose-700">{health!.out.toLocaleString()}</p><p className="text-slate-500">在庫切れ</p></Link>
              </div>
            </Panel>

            {/* 登録推移（折れ線・月/年） */}
            <Panel title="登録推移" subtitle={trendUnit === "year" ? "年別の登録点数" : `${effectiveYear || "—"}年の登録点数（1〜12月）`}>
              <div className="mb-2 flex flex-wrap items-center justify-end gap-1">
                {trendUnit === "month" && trendYears.length > 0 && (
                  <select
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px]"
                    value={effectiveYear}
                    onChange={(e) => setTrendYear(e.target.value)}
                  >
                    {trendYears.map((y) => <option key={y} value={y}>{y}年</option>)}
                  </select>
                )}
                {(["month", "year"] as const).map((unit) => (
                  <button
                    key={unit}
                    className={`rounded border px-2 py-0.5 text-[11px] ${trendUnit === unit ? "border-app bg-app-soft text-app-link" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                    onClick={() => setTrendUnit(unit)}
                  >
                    {unit === "month" ? "月別" : "年別"}
                  </button>
                ))}
              </div>
              <LineChart points={trendPoints} />
            </Panel>

            {/* カテゴリ別 */}
            <Panel title="カテゴリ別の部品点数" subtitle="点数の多い順">
              <div className="grid gap-1.5">
                {data.byCategory.slice(0, 12).map((c, i) => (
                  <BarRow
                    key={c.name}
                    label={c.name}
                    value={c.count}
                    max={maxCategoryCount}
                    color={CHART_COLORS[i % CHART_COLORS.length]}
                    hint={`${c.count.toLocaleString()}件 / ${formatPrice(c.value)}`}
                  />
                ))}
              </div>
            </Panel>

            {/* ステータス別 */}
            <Panel title="ステータス別の内訳" subtitle="ステータスごとの部品点数・在庫数・在庫金額">
              {data.byStatus.length === 0 ? (
                <p className="text-xs text-slate-500">ステータスのデータがありません。</p>
              ) : (
                <div className="grid gap-1.5">
                  {data.byStatus.map((status) => (
                    <StatusBarRow key={status.id ?? "none"} status={status} max={maxStatus} />
                  ))}
                </div>
              )}
            </Panel>

            {/* メーカー別 */}
            <Panel title="メーカー別の部品点数" subtitle="上位12件">
              <div className="grid gap-1.5">
                {data.byManufacturer.map((m, i) => (
                  <BarRow
                    key={m.name}
                    label={m.name}
                    value={m.count}
                    max={maxManufacturer}
                    color={CHART_COLORS[i % CHART_COLORS.length]}
                    to={m.name === "(未設定)" ? undefined : `/parts?manufacturer=${encodeURIComponent(m.name)}`}
                  />
                ))}
              </div>
            </Panel>

            {/* 保管場所別 */}
            <Panel title="保管場所別の部品点数" subtitle="上位12件">
              <div className="grid gap-1.5">
                {data.byLocation.map((l, i) => (
                  <BarRow key={l.name} label={l.name} value={l.count} max={maxLocation} color={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </div>
            </Panel>

            {/* 在庫金額 上位 */}
            <Panel title="在庫金額の大きい部品 TOP10" subtitle="単価 × 在庫数">
              {data.topValueParts.length === 0 ? (
                <p className="text-xs text-slate-500">単価が設定された在庫がありません。</p>
              ) : (
                <ol className="grid gap-1 text-xs">
                  {data.topValueParts.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-4 shrink-0 text-right tabular-nums text-slate-400">{i + 1}</span>
                        <Link to={`/parts/${p.id}`} className="truncate text-app-link hover:underline" title={p.modelNumber}>{p.modelNumber}</Link>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-slate-400">{formatPrice(p.price)} × {p.stock.toLocaleString()}</span>
                        <span className="font-semibold tabular-nums text-slate-800">{formatPrice(p.value)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
