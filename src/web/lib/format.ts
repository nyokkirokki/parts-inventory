export function formatPrice(value?: number | null): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatDate(value: string): string {
  const utcValue = value.endsWith("Z") ? value : value + "Z";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(utcValue));
}
