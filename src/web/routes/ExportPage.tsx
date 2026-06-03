import { useEffect, useState } from "react";
import type { Category } from "@shared/types";
import { apiClient } from "../lib/api-client";

function createDownloadLink(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ExportPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [format, setFormat] = useState("json");
  const [mode, setMode] = useState("flat");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiClient.listCategories().then(setCategories).catch((err) => {
      setError(err instanceof Error ? err.message : "カテゴリの読み込みに失敗しました。");
    });
  }, []);

  const params = new URLSearchParams({ format });
  if (categoryId) params.set("categoryId", categoryId);
  if (format === "json") params.set("mode", mode);

  const handleExport = async () => {
    setError("");
    setJsonText("");
    setProgress(0);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/export/parts?${params.toString()}`);
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Export failed: ${response.status} ${body}`);
      }

      if (format === "json") {
        const payload = await response.json();
        setJsonText(JSON.stringify(payload, null, 2));
        setProgress(100);
        setIsLoading(false);
        return;
      }

      const contentType = response.headers.get("content-type") ?? "application/octet-stream";
      const contentDisposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = /filename="(?<name>[^"]+)"/.exec(contentDisposition);
      const fallbackFilename = format === "pdf" ? "parts-export.pdf" : format === "csv" ? "parts-export.csv" : "parts-export.xlsx";
      const filename = filenameMatch?.groups?.name ?? fallbackFilename;

      const reader = response.body?.getReader();
      if (!reader) {
        const blob = await response.blob();
        createDownloadLink(blob, filename);
        setProgress(100);
        setIsLoading(false);
        return;
      }

      const contentLength = Number(response.headers.get("content-length") ?? "0");
      const chunks: Uint8Array[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          if (contentLength > 0) {
            setProgress(Math.min(100, Math.round((loaded / contentLength) * 100)));
          }
        }
      }

      const blob = new Blob(chunks.map((chunk) => {
        const buffer = new ArrayBuffer(chunk.byteLength);
        new Uint8Array(buffer).set(chunk);
        return buffer;
      }), { type: contentType });
      createDownloadLink(blob, filename);
      setProgress(100);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyJson = async () => {
    if (!jsonText) return;
    try {
      await navigator.clipboard.writeText(jsonText);
    } catch (clipboardError) {
      setError("クリップボードへのコピーに失敗しました。手動でコピーしてください。");
    }
  };

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h1 className="text-xl font-semibold">エクスポート</h1>
      </section>
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <label className="grid gap-1 text-sm font-medium">
          カテゴリ
          <select className="rounded-md border px-3 py-2" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">全カテゴリ</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          形式
          <select className="rounded-md border px-3 py-2" value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="json">JSON</option>
            <option value="excel">Excel</option>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        {format === "json" && (
          <fieldset className="grid gap-2 text-sm">
            <legend className="mb-1 font-medium">JSON形式</legend>
            <label className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 ${mode === "flat" ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
              <input type="radio" name="json-mode" value="flat" checked={mode === "flat"} onChange={(event) => setMode(event.target.value)} className="mt-0.5" />
              <span>
                <span className="font-medium">フラット形式（読みやすい・表向き）</span>
                <span className="block text-xs text-slate-500">カテゴリごとに列見出し付きの表形式で出力。属性は単位付きの文字列にまとめます。人が読む・スプレッドシートに貼る用途に。</span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 ${mode === "raw" ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
              <input type="radio" name="json-mode" value="raw" checked={mode === "raw"} onChange={(event) => setMode(event.target.value)} className="mt-0.5" />
              <span>
                <span className="font-medium">ロー形式（元データそのまま）</span>
                <span className="block text-xs text-slate-500">部品データを加工せず出力。属性・タグ・全フィールドを保持します。バックアップ・再インポート・プログラム処理向け。</span>
              </span>
            </label>
          </fieldset>
        )}
        <button
          type="button"
          className="rounded-md bg-slate-900 px-4 py-3 text-center font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleExport}
          disabled={isLoading}
        >
          {isLoading ? `エクスポート中${progress > 0 ? ` ${progress}%` : ""}` : "エクスポート開始"}
        </button>
        {isLoading && (
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </section>
      {jsonText && (
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">JSON 出力</h2>
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              onClick={handleCopyJson}
            >
              コピー
            </button>
          </div>
          <textarea
            readOnly
            className="mt-3 min-h-[240px] w-full rounded-md border px-3 py-2 font-mono text-sm text-slate-800"
            value={jsonText}
          />
        </section>
      )}
    </div>
  );
}
