// 配色テーマ（パレット）。ライト/ダークとは別軸で管理し、各テーマが
// light/dark 両対応する。実際の色は styles.css の :root[data-theme=...] で定義。
// swatch はテーマ選択UIのプレビュー用代表色（ライト時の --accent と一致）。
export const THEME_PALETTES = [
  { id: "blue", label: "ブルー", swatch: "#315f8f" },
  { id: "forest", label: "フォレスト", swatch: "#3f7d58" },
  { id: "mono", label: "モノクロ", swatch: "#5b6471" },
  { id: "warm", label: "ウォーム", swatch: "#c2683a" },
] as const;

export type ThemePalette = (typeof THEME_PALETTES)[number]["id"];
export type ThemeMode = "light" | "dark";

const PALETTE_STORAGE_KEY = "themePalette";
const MODE_STORAGE_KEY = "theme";

const PALETTE_IDS = THEME_PALETTES.map((p) => p.id) as readonly string[];

export function getStoredPalette(): ThemePalette {
  if (typeof window === "undefined") return "blue";
  const saved = window.localStorage.getItem(PALETTE_STORAGE_KEY);
  return saved && PALETTE_IDS.includes(saved) ? (saved as ThemePalette) : "blue";
}

export function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(MODE_STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyPalette(palette: ThemePalette): void {
  document.documentElement.setAttribute("data-theme", palette);
  window.localStorage.setItem(PALETTE_STORAGE_KEY, palette);
}

export function applyMode(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", mode === "dark");
  window.localStorage.setItem(MODE_STORAGE_KEY, mode);
}
