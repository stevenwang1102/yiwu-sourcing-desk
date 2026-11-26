import type { Settings } from "./types";

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function formatInt(n: number) {
  return Math.round(n).toLocaleString("zh-CN");
}

export function formatUsd(n: number) {
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatMoney(usd: number, settings: Settings) {
  if (settings.currency === "CNY") {
    return `¥${Math.round(usd * settings.fxUsdCny).toLocaleString("zh-CN")}`;
  }
  return formatUsd(usd);
}

export function formatRange(pair: [number, number], settings: Settings) {
  return `${formatMoney(pair[0], settings)}–${formatMoney(pair[1], settings)}`;
}

export function pct(n: number) {
  return `${Math.round(n)}%`;
}

export function signedPct(n: number) {
  const rounded = Math.round(n);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function gradeLabel(grade: "A" | "B" | "C") {
  if (grade === "A") return "优先准备报价和样品";
  if (grade === "B") return "可以推荐，先补未知项";
  return "不作为主推，除非客户点名";
}

export function shortText(text: string, max = 72) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
