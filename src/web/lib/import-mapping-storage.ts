import type { BlockMapping } from "./excel-parser";

// シート＋ヘッダ構成(signature)ごとにマッピングを保存し、次回以降の取り込みで再利用する。
const PREFIX = "import_mapping:";

export function getSavedMapping(signature: string): BlockMapping | null {
  try {
    const raw = localStorage.getItem(PREFIX + signature);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    const mapping: BlockMapping = {};
    for (const [key, value] of Object.entries(parsed)) mapping[Number(key)] = value as BlockMapping[number];
    return mapping;
  } catch {
    return null;
  }
}

export function saveMapping(signature: string, mapping: BlockMapping): void {
  try {
    localStorage.setItem(PREFIX + signature, JSON.stringify(mapping));
  } catch {
    // localStorage 不可環境では保存しない
  }
}
