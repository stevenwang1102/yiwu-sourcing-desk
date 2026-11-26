import { clamp } from "./format";
import { MARKET_MAP } from "./markets";
import type { MarketId, Product, Settings } from "./types";

export interface MarketSignal {
  market: MarketId;
  primary: boolean;
  monthlySearches: number | null;
  kd: number | null;
  cpc: number | null;
  trend: number | null;
  intent: number | null;
  aio: number | null;
}

export function marketSignal(product: Product, market: MarketId): MarketSignal {
  const factor = MARKET_MAP[market];
  const primary = product.markets.includes(market);
  if (!primary) {
    return {
      market,
      primary: false,
      monthlySearches: null,
      kd: null,
      cpc: null,
      trend: null,
      intent: null,
      aio: null,
    };
  }
  return {
    market,
    primary: true,
    monthlySearches: Math.max(10, Math.round(product.sv * factor.sv)),
    kd: clamp(Math.round(product.kd + factor.kd), 8, 92),
    cpc: Math.round(product.cpc * factor.cpc * 100) / 100,
    trend: product.trend,
    intent: clamp(Math.round(product.intent + factor.intent), 8, 92),
    aio: clamp(Math.round(product.aio + factor.aio), 0, 90),
  };
}

export function demandScore(searches: number) {
  return clamp((Math.log10(Math.max(searches, 10)) / Math.log10(80000)) * 100, 0, 100);
}

export function tradeFit(product: Product) {
  const moqScore = product.moq <= 200 ? 88 : product.moq <= 500 ? 74 : product.moq <= 1000 ? 58 : 42;
  const labelScore = product.labelEase === "容易" ? 86 : product.labelEase === "一般" ? 64 : 40;
  return (moqScore + labelScore) / 2;
}

export interface ScoreParts {
  index: number;
  grade: "A" | "B" | "C";
  demand: number;
  ease: number;
  intent: number;
  trend: number;
  trade: number;
  signal: MarketSignal;
}

export function scoreProduct(product: Product, market: MarketId): ScoreParts | null {
  const signal = marketSignal(product, market);
  if (signal.monthlySearches == null || signal.kd == null || signal.intent == null || signal.trend == null) {
    return null;
  }
  const demand = demandScore(signal.monthlySearches);
  const ease = 100 - signal.kd;
  const intent = signal.intent;
  const trend = clamp(50 + signal.trend * 2, 0, 100);
  const trade = tradeFit(product);
  const index = Math.round(demand * 0.3 + ease * 0.22 + intent * 0.18 + trend * 0.12 + trade * 0.18);
  let grade: "A" | "B" | "C" = "C";
  if (index >= 74 && signal.kd <= 58) grade = "A";
  else if (index >= 60) grade = "B";
  return { index, grade, demand, ease, intent, trend, trade, signal };
}

export function difficultyBand(kd: number) {
  if (kd < 35) return "低";
  if (kd > 55) return "高";
  return "中";
}

export interface Estimate {
  inquiries: number | null;
  budget: number | null;
  svProvenance: "sample" | "measured" | "unknown";
  cpcProvenance: "sample" | "measured" | "unknown";
  formulaNote: string;
}

export function inquiryEstimate(searches: number | null, settings: Settings) {
  if (searches == null) return null;
  return Math.round(searches * settings.clickShare * settings.inquiryRate);
}

export function budgetEstimate(cpc: number | null, settings: Settings) {
  if (cpc == null) return null;
  return Math.round(cpc * settings.testClicks);
}

export function weightedIntent(products: Product[], market: MarketId) {
  let weight = 0;
  let sum = 0;
  for (const product of products) {
    const signal = marketSignal(product, market);
    if (signal.monthlySearches == null || signal.intent == null) continue;
    weight += signal.monthlySearches;
    sum += signal.monthlySearches * signal.intent;
  }
  if (!weight) return null;
  return Math.round(sum / weight);
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
