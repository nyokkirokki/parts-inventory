export const COLUMN_ORDER_STORAGE_KEY = "electronicsInventory.partsList.columnOrder.v2";

export type ColumnOrderStorage = Record<string, string[]>;

export function getColumnOrderScope(categoryId: string | null | undefined): string {
  return categoryId ? `category:${categoryId}` : "default";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function readColumnOrderStorage(storage: Storage = localStorage): ColumnOrderStorage {
  try {
    const parsed = JSON.parse(storage.getItem(COLUMN_ORDER_STORAGE_KEY) ?? "null") as unknown;
    if (isStringArray(parsed)) {
      return { default: parsed };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => isStringArray(value))
        .map(([scope, value]) => [scope, value]),
    );
  } catch {
    return {};
  }
}

export function getStoredColumnOrder(scope: string, storage: Storage = localStorage): string[] | null {
  return readColumnOrderStorage(storage)[scope] ?? null;
}

export function setStoredColumnOrder(scope: string, order: string[], storage: Storage = localStorage): void {
  const next = readColumnOrderStorage(storage);
  next[scope] = order;
  storage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(next));
}

export function removeStoredColumnOrder(scope: string, storage: Storage = localStorage): void {
  const next = readColumnOrderStorage(storage);
  delete next[scope];

  if (Object.keys(next).length === 0) {
    storage.removeItem(COLUMN_ORDER_STORAGE_KEY);
    return;
  }

  storage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(next));
}

// --- 列の表示/非表示（スコープごとに「非表示にした列キー」を保存） ---
export const HIDDEN_COLUMNS_STORAGE_KEY = "electronicsInventory.partsList.hiddenColumns.v1";

function readHiddenColumnsStorage(storage: Storage = localStorage): ColumnOrderStorage {
  try {
    const parsed = JSON.parse(storage.getItem(HIDDEN_COLUMNS_STORAGE_KEY) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => isStringArray(value))
        .map(([scope, value]) => [scope, value]),
    );
  } catch {
    return {};
  }
}

export function getStoredHiddenColumns(scope: string, storage: Storage = localStorage): string[] {
  return readHiddenColumnsStorage(storage)[scope] ?? [];
}

// スコープに保存値があるか（初期非表示列のシード判定に使う。未保存なら
// 既定の非表示セットを適用し、保存済みならユーザーの選択を尊重する）。
export function hasStoredHiddenColumns(scope: string, storage: Storage = localStorage): boolean {
  return scope in readHiddenColumnsStorage(storage);
}

export function setStoredHiddenColumns(scope: string, hidden: string[], storage: Storage = localStorage): void {
  // 空配列でも保存する（「ユーザーが全列表示にした」状態と「未設定（=既定の
  // 非表示をシード）」を区別するため。hasStoredHiddenColumns 参照）。
  const next = readHiddenColumnsStorage(storage);
  next[scope] = hidden;
  storage.setItem(HIDDEN_COLUMNS_STORAGE_KEY, JSON.stringify(next));
}
