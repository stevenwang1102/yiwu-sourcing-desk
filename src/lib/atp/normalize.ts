import { ATP_BUCKETS, type AtpBucket } from "./constants";
import type { AtpKeywordRow, AtpOutcome, NormalizedReport } from "./types";

const ROW_CAP = 800;
const BUCKET_SET = new Set<string>(ATP_BUCKETS);
const PROVIDERS = new Set(["gweb", "google", "youtube", "bing", "amazon", "tiktok", "instagram", "chatgpt", "gemini"]);
const KEYWORD_KEYS = ["keyword", "suggestion", "query", "phrase", "term"] as const;
const VOLUME_KEYS = ["search_volume", "volume", "avg_monthly_searches", "monthly_searches"] as const;
const CPC_KEYS = ["cost_per_click", "cpc"] as const;
const SKIP_KEYS = new Set(["added", "gone", "withheld_by_modifier", "pagination", "links", "user", "token", "email"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readMetric(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-" || trimmed === "–" || /^n\/a$/i.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function readKnownMetric(record: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    return readMetric(record[key]);
  }
  return null;
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readLabel(value: unknown): string | null {
  const direct = readText(value);
  if (direct) return direct;
  const record = asRecord(value);
  if (!record) return null;
  return readText(record.label) ?? readText(record.name) ?? readText(record.value);
}

function bucketOf(value: string | null): AtpBucket | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return BUCKET_SET.has(key) ? (key as AtpBucket) : null;
}

function keywordText(record: Record<string, unknown>) {
  for (const key of KEYWORD_KEYS) {
    const text = readText(record[key]);
    if (text) return text;
  }
  const hasMetric = VOLUME_KEYS.some((key) => Object.prototype.hasOwnProperty.call(record, key))
    || CPC_KEYS.some((key) => Object.prototype.hasOwnProperty.call(record, key));
  if (!hasMetric) return null;
  return readText(record.string);
}

interface WalkContext {
  bucket: AtpBucket;
  modifier: string | null;
  provider: string | null;
}

function withheldTotal(node: unknown): number {
  if (Array.isArray(node)) return node.reduce((sum, item) => sum + withheldTotal(item), 0);
  const record = asRecord(node);
  if (!record) return 0;
  let childSum = 0;
  for (const [key, value] of Object.entries(record)) {
    if (key === "withheld_results_count") continue;
    childSum += withheldTotal(value);
  }
  if (childSum > 0) return childSum;
  return typeof record.withheld_results_count === "number" && Number.isFinite(record.withheld_results_count)
    ? record.withheld_results_count
    : 0;
}

function collectOutcomes(node: unknown, provider: string | null, out: AtpOutcome[]) {
  if (Array.isArray(node)) {
    for (const item of node) collectOutcomes(item, provider, out);
    return;
  }
  const record = asRecord(node);
  if (!record) return;
  const nextProvider = readText(record.provider) ?? (provider && PROVIDERS.has(provider) ? provider : provider);
  const hasSignal = typeof record.collection_outcome === "string" || "suggested_keyword" in record || typeof record.refreshing === "boolean";
  if (hasSignal) {
    const suggested = asRecord(record.suggested_keyword);
    out.push({
      provider: nextProvider ?? "unknown",
      outcome: readText(record.collection_outcome),
      refreshing: typeof record.refreshing === "boolean" ? record.refreshing : null,
      completed: typeof record.completed === "boolean" ? record.completed : null,
      suggestedKeyword: suggested ? readText(suggested.keyword) : null,
      suggestedType: suggested ? readText(suggested.type) : null,
    });
  }
  for (const [key, value] of Object.entries(record)) {
    if (SKIP_KEYS.has(key)) continue;
    const childProvider = PROVIDERS.has(key) ? key : nextProvider;
    collectOutcomes(value, childProvider, out);
  }
}

function dedupeOutcomes(rows: AtpOutcome[]) {
  const seen = new Set<string>();
  const kept: AtpOutcome[] = [];
  for (const row of rows) {
    const key = [row.provider, row.outcome, row.suggestedKeyword, row.refreshing, row.completed].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
  }
  return kept;
}

function walkRows(node: unknown, ctx: WalkContext, out: AtpKeywordRow[]) {
  if (Array.isArray(node)) {
    for (const item of node) walkRows(item, ctx, out);
    return;
  }
  const record = asRecord(node);
  if (!record) return;

  const explicitBucket = bucketOf(readText(record.source) ?? readText(record.source_name) ?? readText(record.bucket));
  const explicitProvider = readText(record.provider);
  const next: WalkContext = {
    bucket: explicitBucket ?? ctx.bucket,
    modifier: ctx.modifier,
    provider: explicitProvider && PROVIDERS.has(explicitProvider) ? explicitProvider : ctx.provider,
  };
  const namedModifier = readText(record.modifier) ?? readText(record.modifier_name) ?? readText(record.category);
  if (namedModifier && !bucketOf(namedModifier)) next.modifier = namedModifier;
  const groupName = readText(record.name);
  if (groupName && (record.suggestions || record.keywords || record.modifiers)) {
    const namedBucket = bucketOf(groupName);
    if (namedBucket) next.bucket = namedBucket;
    else if (!namedModifier) next.modifier = groupName;
  }

  const keyword = keywordText(record);
  if (keyword) {
    out.push({
      keyword,
      bucket: next.bucket,
      modifier: next.modifier,
      searchVolume: readKnownMetric(record, VOLUME_KEYS),
      cpc: readKnownMetric(record, CPC_KEYS),
      intent: readLabel(record.intent ?? record.search_intent),
      sentiment: readLabel(record.sentiment),
      provider: next.provider,
    });
    return;
  }

  for (const [key, value] of Object.entries(record)) {
    if (SKIP_KEYS.has(key)) continue;
    const keyBucket = bucketOf(key);
    const child: WalkContext = {
      bucket: keyBucket ?? next.bucket,
      modifier: next.modifier,
      provider: PROVIDERS.has(key) ? key : next.provider,
    };
    if (!keyBucket && !PROVIDERS.has(key) && key !== "data" && key !== "results" && key !== "sources" && key !== "modifiers" && key !== "suggestions" && key !== "keywords" && key !== "search") {
      const group = asRecord(value);
      const looksLikeGroup = Array.isArray(value) || Boolean(group && (group.suggestions || group.keywords || group.modifiers));
      if (looksLikeGroup && key.length <= 24 && !bucketOf(key)) child.modifier = key;
    }
    walkRows(value, child, out);
  }
}

function prefer(current: AtpKeywordRow, incoming: AtpKeywordRow): AtpKeywordRow {
  return {
    ...current,
    searchVolume: current.searchVolume ?? incoming.searchVolume,
    cpc: current.cpc ?? incoming.cpc,
    intent: current.intent ?? incoming.intent,
    sentiment: current.sentiment ?? incoming.sentiment,
    provider: current.provider ?? incoming.provider,
    modifier: current.modifier ?? incoming.modifier,
  };
}

function shapeKeys(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  if (!data) return [];
  return Object.keys(data).slice(0, 30);
}

export function normalizeReport(payload: unknown): NormalizedReport {
  const collected: AtpKeywordRow[] = [];
  walkRows(payload, { bucket: "other", modifier: null, provider: null }, collected);
  const merged = new Map<string, AtpKeywordRow>();
  for (const row of collected) {
    const key = [row.provider ?? "", row.bucket, row.modifier ?? "", row.keyword.toLowerCase()].join("|");
    const existing = merged.get(key);
    merged.set(key, existing ? prefer(existing, row) : row);
  }
  const order = new Map(ATP_BUCKETS.map((bucket, index) => [bucket, index]));
  const rows = [...merged.values()].sort((a, b) => (order.get(a.bucket) ?? 99) - (order.get(b.bucket) ?? 99));
  const outcomes = dedupeOutcomes([]);
  collectOutcomes(payload, null, outcomes);
  return {
    rows: rows.slice(0, ROW_CAP),
    withheldCount: withheldTotal(payload),
    truncated: rows.length > ROW_CAP,
    outcomes: dedupeOutcomes(outcomes),
    shapeKeys: shapeKeys(payload),
  };
}
