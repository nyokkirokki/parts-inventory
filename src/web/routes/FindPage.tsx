import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Category, AttributeDefinition } from "@shared/types";
import { Loading } from "../components/ui/Loading";
import { apiClient } from "../lib/api-client";

type SpecFilterOperator = "eq" | "gte" | "gt" | "lte" | "lt";

export function FindPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [uniqueSpecs, setUniqueSpecs] = useState<AttributeDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSpec, setSelectedSpec] = useState<AttributeDefinition | null>(null);
  const [specValues, setSpecValues] = useState<{ value: string; unit: string | null; count: number }[]>([]);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [customOp, setCustomOp] = useState<SpecFilterOperator>("eq");
  const [customVal, setCustomVal] = useState("");
  const [customError, setCustomError] = useState("");

  useEffect(() => {
    apiClient.listCategories().then(async (cats) => {
      setCategories(cats);

      const allAttrs: AttributeDefinition[] = [];
      const promises = cats.map(async (cat) => {
        const attrs = await apiClient.listCategoryAttributes(cat.id);
        allAttrs.push(...attrs.filter((a) => a.isSearchable));
      });
      await Promise.all(promises);

      const unique = allAttrs.reduce((acc, curr) => {
        if (!acc.find((a) => a.label === curr.label)) acc.push(curr);
        return acc;
      }, [] as AttributeDefinition[]);

      unique.sort((a, b) => a.label.localeCompare(b.label, "ja-JP"));
      setUniqueSpecs(unique);
      setIsLoading(false);
    });
  }, []);

  async function selectSpec(spec: AttributeDefinition) {
    setSelectedSpec(spec);
    setCustomOp("eq");
    setCustomVal("");
    setCustomError("");
    setIsLoadingValues(true);
    try {
      const values = await apiClient.listAttributeValues(spec.key);
      setSpecValues(values);
    } finally {
      setIsLoadingValues(false);
    }
  }

  function buildAttrsUrl(op: SpecFilterOperator, val: string): string {
    if (!selectedSpec || !val) return "/parts";
    const filter = op === "eq" ? val : { op, val };
    const attrsParam = encodeURIComponent(JSON.stringify({ [selectedSpec.key]: filter }));
    return `/parts?attrs=${attrsParam}&archived=active`;
  }

  function handleCustomSearch() {
    if (!customVal) return;
    if (customOp !== "eq" && !Number.isFinite(Number(customVal.trim()))) {
      setCustomError("比較条件（> < ≧ ≦）には数値を入力してください。");
      return;
    }
    setCustomError("");
    navigate(buildAttrsUrl(customOp, customVal));
  }

  if (isLoading) return <Loading />;

  return (
    <div className="mx-auto max-w-5xl space-y-12 py-4">
      <header className="text-left">
        <h1 className="text-2xl font-bold text-slate-900">部品を探す</h1>
        <p className="mt-2 text-slate-500">ジャンルや仕様から目的の部品を探索できます。</p>
      </header>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-bold">ジャンルから探す</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/parts?categoryId=${category.id}`}
              className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-app-link hover:shadow-md"
            >
              <span className="font-semibold text-slate-900">{category.name}</span>
              <span className="mt-1 text-xs text-slate-500">{category.partCount || 0} 点の在庫</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-bold">電気的特性から探す</h2>
        </div>
        {uniqueSpecs.length === 0 ? (
          <p className="text-sm text-slate-500">定義された電気的特性はありません。</p>
        ) : (
          <div className="flex gap-4">
            {/* Left: spec label list */}
            <div className="w-44 shrink-0 space-y-1">
              {uniqueSpecs.map((spec) => (
                <button
                  key={spec.label}
                  onClick={() => selectSpec(spec)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                    selectedSpec?.label === spec.label
                      ? "border-app bg-app-soft text-app-link"
                      : "border-slate-200 bg-white text-slate-700 hover:border-app-link hover:text-app-link"
                  }`}
                >
                  {spec.label}
                </button>
              ))}
            </div>

            {/* Right: value browser */}
            <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-4">
              {!selectedSpec ? (
                <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                  左の特性名をクリックすると値の一覧が表示されます
                </div>
              ) : isLoadingValues ? (
                <Loading />
              ) : (
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-800">{selectedSpec.label}</h3>

                  {/* Custom operator filter */}
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
                    <span className="text-xs text-slate-500">条件で検索:</span>
                    <select
                      className="h-7 rounded border border-slate-300 px-1 text-xs"
                      value={customOp}
                      onChange={(e) => {
                        setCustomOp(e.target.value as SpecFilterOperator);
                        setCustomError("");
                      }}
                    >
                      <option value="eq">=</option>
                      <option value="gt">{">"}</option>
                      <option value="gte">{">="}</option>
                      <option value="lt">{"<"}</option>
                      <option value="lte">{"<="}</option>
                    </select>
                    <input
                      className="h-7 w-28 rounded border border-slate-300 px-2 text-xs"
                      placeholder={selectedSpec.unit ? `値 (${selectedSpec.unit})` : "値を入力..."}
                      value={customVal}
                      onChange={(e) => {
                        setCustomVal(e.target.value);
                        setCustomError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleCustomSearch()}
                    />
                    <button
                      className="btn h-7 px-3 text-xs btn-primary"
                      disabled={!customVal}
                      onClick={handleCustomSearch}
                    >
                      検索
                    </button>
                    {customError && <span className="w-full text-xs text-red-600">{customError}</span>}
                  </div>

                  {/* Value list */}
                  {specValues.length === 0 ? (
                    <p className="text-sm text-slate-400">登録された値はありません。</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {specValues.map((v) => {
                        const display = v.unit ? `${v.value}${v.unit}` : v.value;
                        return (
                          <Link
                            key={`${v.value}-${v.unit}`}
                            to={buildAttrsUrl("eq", v.value)}
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm shadow-sm transition-all hover:border-app-link hover:text-app-link hover:shadow-md"
                          >
                            <span className="font-medium text-slate-700">{display}</span>
                            <span className="text-xs text-slate-400">{v.count}件</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
