import { useEffect, useMemo, useState } from "react";
import { apiClient, type ImportBatchSummary } from "../lib/api-client";
import { formatDate } from "../lib/format";
import { parseJsonRows, type ImportRow } from "../lib/import-parser";
import {
  buildRowsForBlock,
  defaultMapping,
  FIELD_TARGET_LABELS,
  parseWorkbook,
  type BlockMapping,
  type ExcelBlock,
  type FieldTarget,
} from "../lib/excel-parser";
import { getSavedMapping, saveMapping } from "../lib/import-mapping-storage";

type ImportResult = { created: number; updated: number; skipped: number; failed: number; errors: { row: number; error: string }[] };
type Mode = "skip" | "update";

const FIELD_TARGETS = Object.keys(FIELD_TARGET_LABELS) as FieldTarget[];

const sample = `[
  {
    "category": "RFトランシーバ",
    "model_number": "RF-001",
    "name": "2.4GHz Module",
    "stock_quantity": 10,
    "price": 320,
    "case_number": "A-01",
    "tags": "rf,uart",
    "memo": "検証用",
    "low_stock_threshold": 3,
    "attributes_json": {
      "frequency": { "value": "2.4", "unit": "GHz" }
    }
  }
]`;

export function ImportPage() {
  const [tab, setTab] = useState<"excel" | "json">("excel");
  const [refreshSignal, setRefreshSignal] = useState(0);
  const onImported = () => setRefreshSignal((n) => n + 1);

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h1 className="text-xl font-semibold">インポート</h1>
        <p className="mt-1 text-sm text-slate-600">Excel（フォーマット自動解析＋マッピング）または JSON から部品を取り込みます。既存部品は「スキップ」か「更新」を選べます。取り込みは7日以内なら取り消せます。</p>
        <div className="mt-3 flex gap-2">
          <button className={`btn ${tab === "excel" ? "border-app bg-app-soft text-app-link" : ""}`} onClick={() => setTab("excel")}>Excel取り込み</button>
          <button className={`btn ${tab === "json" ? "border-app bg-app-soft text-app-link" : ""}`} onClick={() => setTab("json")}>JSON取り込み</button>
        </div>
      </section>
      {tab === "excel" ? <ExcelImport onImported={onImported} /> : <JsonImport onImported={onImported} />}
      <RecentImports refreshSignal={refreshSignal} />
    </div>
  );
}

function RecentImports({ refreshSignal }: { refreshSignal: number }) {
  const [batches, setBatches] = useState<ImportBatchSummary[]>([]);
  const [reverting, setReverting] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  function reload() {
    apiClient.listImportBatches().then(setBatches).catch(() => setBatches([]));
  }

  useEffect(() => {
    reload();
  }, [refreshSignal]);

  async function revert(batch: ImportBatchSummary) {
    if (!confirm("この取り込みを取り消します。新規追加分は削除、更新分は取り込み前の状態に戻します。よろしいですか？")) return;
    setMessage("");
    try {
      setReverting(batch.id);
      const result = await apiClient.revertImportBatch(batch.id);
      setMessage(`取り消しました（削除 ${result.deleted} / 復元 ${result.restored}${result.failed ? ` / 失敗 ${result.failed}` : ""}）`);
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "取り消しに失敗しました。");
    } finally {
      setReverting(null);
    }
  }

  return (
    <section className="grid gap-2 rounded-md border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-950">最近の取り込み（7日以内は取り消し可）</h2>
      {batches.length === 0 ? (
        <p className="text-sm text-slate-600">取り込み履歴はありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {["日時", "モード", "新規", "更新", "スキップ", "状態", ""].map((h) => (
                  <th key={h} className="border-b border-slate-200 px-3 py-2 font-medium text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-800">{formatDate(batch.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-600">{batch.mode === "update" ? "更新" : "スキップ"}</td>
                  <td className="px-3 py-2 text-slate-800">{batch.createdCount}</td>
                  <td className="px-3 py-2 text-slate-800">{batch.updatedCount}</td>
                  <td className="px-3 py-2 text-slate-800">{batch.skippedCount}</td>
                  <td className="px-3 py-2">{batch.revertedAt ? <span className="text-slate-400">取消済</span> : <span className="text-app-link">取消可</span>}</td>
                  <td className="px-3 py-2">
                    {!batch.revertedAt && batch.revertable && (
                      <button className="btn text-app-danger" disabled={reverting === batch.id} onClick={() => revert(batch)}>
                        {reverting === batch.id ? "取消中" : "元に戻す"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {message && <p className="rounded-md bg-app-soft p-2 text-sm text-app-link">{message}</p>}
    </section>
  );
}

function ModeSelect({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-700">既存部品の扱い</span>
      <select className="h-9 rounded-md border border-slate-300 px-2 text-sm" value={mode} onChange={(e) => onChange(e.target.value as Mode)}>
        <option value="skip">スキップ（既存はそのまま）</option>
        <option value="update">更新（既存も上書き）</option>
      </select>
    </label>
  );
}

function ResultMessage({ result }: { result: ImportResult }) {
  return (
    <div className="grid gap-1 rounded-md bg-app-soft p-3 text-sm text-app-link">
      <span>新規 {result.created} 件 / 更新 {result.updated} 件 / スキップ {result.skipped} 件 / 失敗 {result.failed} 件</span>
      {result.errors.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-app-danger">
          {result.errors.slice(0, 10).map((e) => <li key={e.row}>行{e.row}: {e.error}</li>)}
        </ul>
      )}
    </div>
  );
}

function ExcelImport({ onImported }: { onImported: () => void }) {
  const [fileName, setFileName] = useState("");
  const [blocks, setBlocks] = useState<ExcelBlock[]>([]);
  const [mappings, setMappings] = useState<Record<string, BlockMapping>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [blockTitleAsTag, setBlockTitleAsTag] = useState(true);
  const [statusAsTag, setStatusAsTag] = useState(true);
  const [mode, setMode] = useState<Mode>("skip");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("ファイルサイズが大きすぎます（上限5MB）。");
      setBlocks([]);
      return;
    }
    try {
      const parsed = parseWorkbook(await file.arrayBuffer());
      if (parsed.length === 0) throw new Error("取り込めるテーブルが見つかりませんでした。ヘッダ行（定数/アイテム名/型番）を含むシートが必要です。");
      const nextMappings: Record<string, BlockMapping> = {};
      const nextIncluded: Record<string, boolean> = {};
      for (const block of parsed) {
        nextMappings[block.id] = getSavedMapping(block.signature) ?? defaultMapping(block.headers);
        nextIncluded[block.id] = true;
      }
      setFileName(file.name);
      setBlocks(parsed);
      setMappings(nextMappings);
      setIncluded(nextIncluded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ファイルの解析に失敗しました。");
      setBlocks([]);
    }
  }

  function setColumnTarget(blockId: string, columnIndex: number, target: FieldTarget) {
    setMappings((current) => ({ ...current, [blockId]: { ...current[blockId], [columnIndex]: target } }));
  }

  const buildOptions = useMemo(() => ({ blockTitleAsTag, statusAsTag, lowStockThreshold: 0 }), [blockTitleAsTag, statusAsTag]);

  const previewRows = useMemo(() => {
    const rows: ImportRow[] = [];
    for (const block of blocks) {
      if (!included[block.id]) continue;
      rows.push(...buildRowsForBlock(block, mappings[block.id] ?? defaultMapping(block.headers), buildOptions));
    }
    return rows;
  }, [blocks, included, mappings, buildOptions]);

  async function submit() {
    setError("");
    setResult(null);
    try {
      setIsSubmitting(true);
      if (previewRows.length === 0) throw new Error("インポート対象がありません。");
      const res = await apiClient.importParts(previewRows, mode);
      setResult(res);
      onImported();
      // 使ったマッピングを再利用用に保存
      for (const block of blocks) {
        if (included[block.id] && mappings[block.id]) saveMapping(block.signature, mappings[block.id]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "インポートに失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-3">
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-700">Excelファイル（.xlsx）</label>
        <input type="file" accept=".xlsx,.xls" onChange={onFile} className="text-sm" />
        {fileName && <p className="text-xs text-slate-500">{fileName} / {blocks.length}個のテーブルを検出</p>}
        <div className="flex flex-wrap items-center gap-4">
          <ModeSelect mode={mode} onChange={setMode} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={blockTitleAsTag} onChange={(e) => setBlockTitleAsTag(e.target.checked)} />見出しをタグにする</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={statusAsTag} onChange={(e) => setStatusAsTag(e.target.checked)} />ステータスをタグにする</label>
        </div>
      </section>

      {blocks.map((block) => (
        <BlockCard
          key={block.id}
          block={block}
          mapping={mappings[block.id] ?? defaultMapping(block.headers)}
          included={included[block.id] ?? true}
          onToggle={(v) => setIncluded((c) => ({ ...c, [block.id]: v }))}
          onChangeTarget={(i, t) => setColumnTarget(block.id, i, t)}
        />
      ))}

      {blocks.length > 0 && <ExcelPreview rows={previewRows} />}

      {blocks.length > 0 && (
        <button className="rounded-md bg-slate-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400" disabled={isSubmitting} onClick={submit}>
          {isSubmitting ? "インポート中" : `${previewRows.length}件をインポート`}
        </button>
      )}

      {error && <p className="rounded-md bg-app-soft p-3 text-sm text-app-danger">{error}</p>}
      {result && <ResultMessage result={result} />}
    </div>
  );
}

function BlockCard({
  block,
  mapping,
  included,
  onToggle,
  onChangeTarget,
}: {
  block: ExcelBlock;
  mapping: BlockMapping;
  included: boolean;
  onToggle: (v: boolean) => void;
  onChangeTarget: (columnIndex: number, target: FieldTarget) => void;
}) {
  return (
    <section className={`grid gap-2 rounded-md border p-4 ${included ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-70"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-950">{block.sheetName} <span className="text-slate-400">›</span> {block.blockTitle}</h2>
          <p className="text-xs text-slate-500">{block.status && `${block.status} / `}{block.rows.length}行</p>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={included} onChange={(e) => onToggle(e.target.checked)} />取り込む</label>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse text-left text-xs">
          <thead>
            <tr>
              {block.headers.map((header, i) => (
                <th key={i} className="border-b border-slate-200 px-2 py-1 font-medium text-slate-600">{header || `列${i + 1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {block.headers.map((_, i) => (
                <td key={i} className="border-b border-slate-100 px-2 py-1">
                  <select className="h-7 rounded border border-slate-300 text-xs" value={mapping[i] ?? "ignore"} onChange={(e) => onChangeTarget(i, e.target.value as FieldTarget)}>
                    {FIELD_TARGETS.map((t) => <option key={t} value={t}>{FIELD_TARGET_LABELS[t]}</option>)}
                  </select>
                </td>
              ))}
            </tr>
            {block.rows.slice(0, 3).map((cells, r) => (
              <tr key={r}>
                {cells.map((cell, i) => <td key={i} className="border-b border-slate-50 px-2 py-1 text-slate-500">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatPreviewValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ExcelPreview({ rows }: { rows: ImportRow[] }) {
  const headers = ["category", "model_number", "name", "stock_quantity", "footprint", "tags"];
  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-950">プレビュー（取り込み後の行）</h2>
        <span className="text-sm text-slate-600">{rows.length}件</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">取り込める行がありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>{headers.map((h) => <th key={h} className="border-b border-slate-200 px-3 py-2 font-medium text-slate-600">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row, index) => (
                <tr key={index} className="border-b border-slate-100">
                  {headers.map((h) => <td key={h} className="max-w-64 truncate px-3 py-2 text-slate-800">{formatPreviewValue((row as Record<string, unknown>)[h])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function JsonImport({ onImported }: { onImported: () => void }) {
  const [text, setText] = useState(sample);
  const [mode, setMode] = useState<Mode>("skip");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rows = safeParseJsonRows(text);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);
    setError("");
    try {
      setIsSubmitting(true);
      const importRows = parseJsonRows(text);
      if (importRows.length === 0) throw new Error("インポート対象がありません");
      setResult(await apiClient.importParts(importRows, mode));
      onImported();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "インポートに失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <section className="grid gap-2 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-medium text-slate-700" htmlFor="json-rows">JSONインポート</label>
          <ModeSelect mode={mode} onChange={setMode} />
        </div>
        <textarea id="json-rows" className="min-h-72 rounded-md border border-slate-300 p-3 font-mono text-sm" value={text} onChange={(event) => setText(event.target.value)} />
        <p className="text-xs text-slate-500">{rows.length}件の行を認識</p>
      </section>
      <button className="rounded-md bg-slate-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400" disabled={isSubmitting}>
        {isSubmitting ? "インポート中" : "インポート"}
      </button>
      {error && <p className="rounded-md bg-app-soft p-3 text-sm text-app-danger">{error}</p>}
      {result && <ResultMessage result={result} />}
    </form>
  );
}

function safeParseJsonRows(text: string): ImportRow[] {
  try {
    return parseJsonRows(text);
  } catch {
    return [];
  }
}
