import { useEffect, useState } from "react";
import type { PartStatus } from "@shared/types";
import { Loading } from "../components/ui/Loading";
import { apiClient } from "../lib/api-client";
import { formatDate } from "../lib/format";

const defaultColor = "#64748b";

export function StatusesPage() {
  const [statuses, setStatuses] = useState<PartStatus[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(defaultColor);
  const [sortOrder, setSortOrder] = useState("0");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  function load() {
    apiClient.listStatuses()
      .then(setStatuses)
      .catch((err) => setError(err instanceof Error ? err.message : "ステータスの読み込みに失敗しました"))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setColor(defaultColor);
    setSortOrder("0");
  }

  function startEditing(status: PartStatus) {
    setEditingId(status.id);
    setName(status.name);
    setColor(status.color);
    setSortOrder(String(status.sortOrder));
  }

  async function saveStatus(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const input = { name, color, sortOrder: Number(sortOrder) || 0 };
    try {
      if (editingId) await apiClient.updateStatus(editingId, input);
      else await apiClient.createStatus(input);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ステータスの保存に失敗しました");
    }
  }

  async function deleteStatus(status: PartStatus) {
    if (!confirm(`${status.name} を削除しますか？このステータスが設定された部品は未設定になります。`)) return;
    setError("");
    try {
      await apiClient.deleteStatus(status.id);
      if (editingId === status.id) resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ステータスの削除に失敗しました");
    }
  }

  if (isLoading) return <Loading />;

  return (
    <div className="grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="panel-card p-4 lg:col-span-2">
        <h1 className="text-lg font-bold text-slate-950">ステータス管理</h1>
        <p className="mt-1 text-xs text-slate-500">Active、Obsolete、発注予定など、部品に付ける任意の状態を管理します。</p>
      </section>

      <section className="panel-card p-4">
        <h2 className="text-sm font-semibold">{editingId ? "ステータス編集" : "ステータス追加"}</h2>
        <form onSubmit={saveStatus} className="mt-4 grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            名前
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例: Active / Obsolete"
              required
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            色
            <div className="flex gap-2">
              <input className="h-9 w-12 rounded border border-slate-300" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
              <input className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm" value={color} onChange={(event) => setColor(event.target.value)} />
            </div>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            並び順
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </label>
          {error && <p className="rounded bg-app-soft p-2 text-xs text-app-danger">{error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary">{editingId ? "更新" : "追加"}</button>
            {editingId && <button type="button" className="btn" onClick={resetForm}>キャンセル</button>}
          </div>
        </form>
      </section>

      <section className="panel-card min-w-0 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">登録済みステータス</h2>
          <span className="text-xs text-slate-500">{statuses.length}件</span>
        </div>
        <div className="overflow-auto">
          <table className="dense-table w-full min-w-[640px]">
            <thead><tr><th>名前</th><th>slug</th><th>色</th><th>並び順</th><th>更新日時</th><th>操作</th></tr></thead>
            <tbody>
              {statuses.map((status) => (
                <tr key={status.id}>
                  <td className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                      {status.name}
                    </span>
                  </td>
                  <td className="font-mono text-xs">{status.slug}</td>
                  <td className="font-mono text-xs">{status.color}</td>
                  <td>{status.sortOrder}</td>
                  <td>{formatDate(status.updatedAt)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="text-app-link hover:underline" onClick={() => startEditing(status)}>編集</button>
                      <button className="text-app-danger hover:underline" onClick={() => deleteStatus(status)}>削除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
