import type { DfsMode } from "./constants";

export interface DfsKeywordRow {
  keyword: string;
  monthlySearches: number | null;
  competition: "低" | "中" | "高" | null;
  competitionIndex: number | null;
  cpc: number | null;
  bidLow: number | null;
  bidHigh: number | null;
  bidCurrency: "USD" | null;
  trendIndex: number | null;
  roleLabel: string | null;
  note: string | null;
}

export interface DfsPriceQuote {
  mode: DfsMode;
  label: string;
  channel: string;
  cost: number | null;
  costType: string | null;
}

export interface DfsPublicError {
  ok: false;
  configured: boolean;
  code: string;
  message: string;
  retryAfterSeconds: number | null;
}

export interface DfsAccountResponse {
  ok: true;
  configured: true;
  keywordTask: false;
  balance: number | null;
  prices: DfsPriceQuote[];
  note: string;
}

export interface DfsLookupResponse {
  ok: true;
  mode: DfsMode;
  modeLabel: string;
  channel: string;
  marketId: string;
  locationCode: number;
  locationLabel: string;
  languageCode: string;
  languageLabel: string;
  keywords: string[];
  rows: DfsKeywordRow[];
  truncated: boolean;
  receivedCount: number;
  reused: boolean;
  reuseNote: string | null;
  cost: number | null;
  charged: boolean;
  message: string;
  fetchedAt: string;
  cacheKey: string;
}
