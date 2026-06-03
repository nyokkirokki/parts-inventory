import { useState } from "react";
import { apiClient } from "../../lib/api-client";
import { inputClass } from "../ui/Field";

type StockAdjusterProps = {
  partId: number;
  onChanged: () => void;
};

export function StockAdjuster({ partId, onChanged }: StockAdjusterProps) {
  const [type, setType] = useState<"in" | "out" | "set" | "adjustment" | "use" | "dispose">("in");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await apiClient.changeStock(partId, { type, quantity, reason, memo });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "在庫変更に失敗しました。");
    }
  }

  return (
    <form onSubmit={submit} className="panel-card grid gap-2 p-3">
      <h2 className="text-sm font-semibold">在庫数変更</h2>
      {error && <div className="rounded border border-app bg-app-soft px-2 py-1 text-xs text-app-danger">{error}</div>}
      <div className="grid gap-2">
        <select className={inputClass} value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          <option value="in">入庫</option>
          <option value="out">出庫</option>
          <option value="set">指定数に変更</option>
          <option value="adjustment">調整</option>
          <option value="use">使用</option>
          <option value="dispose">破棄</option>
        </select>
        <input
          className={inputClass}
          type="number"
          min={type === "adjustment" ? undefined : type === "set" ? 0 : 1}
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
        />
        <input
          className={inputClass}
          placeholder="理由"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <input
          className={inputClass}
          placeholder="メモ"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
      </div>
      <button className="btn btn-primary">反映</button>
    </form>
  );
}
