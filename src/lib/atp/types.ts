import type { AtpBucket } from "./constants";

export interface QuotaView {
  period: string | null;
  limit: number | null;
  remaining: number | null;
  used: number | null;
  resetsAt: string | null;
}

export interface RateHint {
  limit: number | null;
  remaining: number | null;
  resetSeconds: number | null;
}

export interface AtpKeywordRow {
  keyword: string;
  bucket: AtpBucket;
  modifier: string | null;
  searchVolume: number | null;
  cpc: number | null;
  intent: string | null;
  sentiment: string | null;
  provider: string | null;
}

export interface AtpOutcome {
  provider: string;
  outcome: string | null;
  refreshing: boolean | null;
  completed: boolean | null;
  suggestedKeyword: string | null;
  suggestedType: string | null;
}

export interface NormalizedReport {
  rows: AtpKeywordRow[];
  withheldCount: number;
  truncated: boolean;
  outcomes: AtpOutcome[];
  shapeKeys: string[];
}

export interface ParentView {
  parentSearchId: string;
  keyword: string;
  language: string;
  region: string;
  status: string;
  createdAt: string | null;
  reused: boolean;
  searches: { id: string; provider: string; status: string }[];
}

export interface PollView {
  id: string;
  status: string;
  provider: string | null;
  keyword: string | null;
  collectionOutcome: string | null;
  suggestedKeyword: string | null;
  suggestedType: string | null;
}

export interface AccountView {
  workspaceName: string | null;
  tier: string | null;
  apiVersion: string | null;
  searches: QuotaView | null;
  reads: QuotaView | null;
}

export interface AtpPublicError {
  ok: false;
  configured: boolean;
  code: string;
  message: string;
  resetsAt: string | null;
  retryAfterSeconds: number | null;
}

export interface AtpAccountResponse {
  ok: true;
  configured: true;
  workspaceName: string | null;
  tier: string | null;
  tierLabel: string;
  apiVersion: string | null;
  searches: QuotaView | null;
  reads: QuotaView | null;
  searchesLine: string;
  readsLine: string;
  note: string;
}

export interface AtpSearchResponse {
  ok: true;
  parentSearchId: string;
  keyword: string;
  language: string;
  region: string;
  status: string;
  reused: boolean;
  message: string;
  searches: { id: string; provider: string; status: string }[];
  rate: RateHint | null;
}

export interface AtpProgressResponse {
  ok: true;
  searches: PollView[];
}

export interface AtpReportResponse extends NormalizedReport {
  ok: true;
  parentSearchId: string;
  page: number;
  perPage: number;
  grouped: boolean;
}
