import { DFS_MODES, IDEAS_ROW_CAP, RELATED_LIMIT, TRENDS_RISING_CAP, TRENDS_TOP_CAP, pricePath, type DfsMode } from "./constants";
import type { DfsKeywordRow, DfsPriceQuote } from "./types";

export interface Envelope {
  topCode: number | null;
  taskCode: number | null;
  result: unknown;
  cost: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function codeOf(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function metricOrNull(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function competitionLabel(value: unknown): "低" | "中" | "高" | null {
  if (typeof value !== "string") return null;
  switch (value.trim().toUpperCase()) {
    case "LOW":
      return "低";
    case "MEDIUM":
      return "中";
    case "HIGH":
      return "高";
    default:
      return null;
  }
}

function joinNotes(parts: Array<string | null | undefined>) {
  const text = parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
  return text || null;
}

function latestMonthNote(monthly: unknown) {
  if (!Array.isArray(monthly)) return null;
  let best: { year: number; month: number; volume: number } | null = null;
  for (const item of monthly) {
    const record = asRecord(item);
    if (!record) continue;
    const year = record.year;
    const month = record.month;
    const volume = metricOrNull(record.search_volume);
    if (typeof year !== "number" || typeof month !== "number" || volume == null) continue;
    if (!best || year > best.year || (year === best.year && month > best.month)) best = { year, month, volume };
  }
  if (!best) return null;
  const month = String(best.month).padStart(2, "0");
  return `最近有数据的月份 ${best.year}-${month} 搜索量 ${best.volume}`;
}

function emptyMetrics(keyword: string, roleLabel: string | null, note: string | null): DfsKeywordRow {
  return {
    keyword,
    monthlySearches: null,
    competition: null,
    competitionIndex: null,
    cpc: null,
    bidLow: null,
    bidHigh: null,
    bidCurrency: null,
    trendIndex: null,
    roleLabel,
    note,
  };
}

function withBids(row: DfsKeywordRow): DfsKeywordRow {
  if (row.bidLow == null && row.bidHigh == null) return row;
  return { ...row, bidCurrency: "USD" };
}

function rowFromMetrics(keyword: string, source: Record<string, unknown> | null, roleLabel: string | null, extraNote: string | null): DfsKeywordRow {
  const info = source ?? {};
  const competition = competitionLabel(info.competition_level) ?? competitionLabel(info.competition);
  const index = metricOrNull(info.competition_index);
  const spell = typeof info.spell === "string" && info.spell.trim() && info.spell.trim().toLowerCase() !== keyword.toLowerCase()
    ? `接口给出的拼写是「${info.spell.trim()}」`
    : null;
  const indexNote = index == null ? null : `竞争指数 ${index}`;
  return withBids({
    ...emptyMetrics(keyword, roleLabel, joinNotes([spell, indexNote, latestMonthNote(info.monthly_searches), extraNote])),
    monthlySearches: metricOrNull(info.search_volume),
    competition,
    competitionIndex: index,
    cpc: metricOrNull(info.cpc),
    bidLow: metricOrNull(info.low_top_of_page_bid),
    bidHigh: metricOrNull(info.high_top_of_page_bid),
  });
}

function adsRow(item: unknown): DfsKeywordRow | null {
  const record = asRecord(item);
  if (!record || typeof record.keyword !== "string" || !record.keyword.trim()) return null;
  return rowFromMetrics(record.keyword.trim(), record, null, null);
}

function labsRow(item: unknown): DfsKeywordRow | null {
  const record = asRecord(item);
  if (!record) return null;
  const data = asRecord(record.keyword_data) ?? record;
  if (typeof data.keyword !== "string" || !data.keyword.trim()) return null;
  const info = asRecord(data.keyword_info);
  return rowFromMetrics(data.keyword.trim(), info, null, null);
}

function richness(row: DfsKeywordRow) {
  return (row.monthlySearches != null ? 4 : 0) + (row.cpc != null ? 2 : 0) + (row.bidLow != null || row.bidHigh != null ? 1 : 0) + (row.trendIndex != null ? 1 : 0);
}

function dedupe(rows: DfsKeywordRow[]) {
  const map = new Map<string, DfsKeywordRow>();
  for (const row of rows) {
    const key = row.keyword.toLowerCase();
    const current = map.get(key);
    if (!current || richness(row) > richness(current)) map.set(key, row);
  }
  return [...map.values()];
}

export function readEnvelope(body: unknown): Envelope {
  const root = asRecord(body);
  const task = root && Array.isArray(root.tasks) ? asRecord(root.tasks[0]) : null;
  const taskCost = metricOrNull(task?.cost);
  const topCost = metricOrNull(root?.cost);
  return {
    topCode: codeOf(root?.status_code),
    taskCode: codeOf(task?.status_code),
    result: task?.result ?? null,
    cost: taskCost ?? topCost,
  };
}

export function normalizeVolume(result: unknown, requested: string[]) {
  const returned = Array.isArray(result) ? result.map(adsRow).filter((row): row is DfsKeywordRow => row != null) : [];
  const byKey = new Set(returned.map((row) => row.keyword.toLowerCase()));
  const missing = requested.filter((keyword) => !byKey.has(keyword.toLowerCase()));
  return { rows: dedupe(returned), receivedCount: returned.length, truncated: false, missing };
}

export function normalizeIdeas(result: unknown) {
  const returned = Array.isArray(result) ? result.map(adsRow).filter((row): row is DfsKeywordRow => row != null) : [];
  const sorted = [...returned].sort((a, b) => {
    if (a.monthlySearches == null && b.monthlySearches == null) return a.keyword.localeCompare(b.keyword, "en");
    if (a.monthlySearches == null) return 1;
    if (b.monthlySearches == null) return -1;
    return b.monthlySearches - a.monthlySearches;
  });
  return {
    rows: sorted.slice(0, IDEAS_ROW_CAP),
    receivedCount: returned.length,
    truncated: returned.length > IDEAS_ROW_CAP,
    missing: [] as string[],
  };
}

export function normalizeRelated(result: unknown) {
  const root = Array.isArray(result) ? asRecord(result[0]) : asRecord(result);
  if (!root) return { rows: [] as DfsKeywordRow[], receivedCount: 0, truncated: false, missing: [] as string[] };
  const seeds = Array.isArray(root.seed_keyword_data)
    ? root.seed_keyword_data.map(labsRow)
    : [labsRow(root.seed_keyword_data)];
  const items = Array.isArray(root.items) ? root.items.map(labsRow) : [];
  const clean = [...seeds, ...items].filter((row): row is DfsKeywordRow => row != null);
  const receivedCount = clean.length;
  const rows = dedupe(clean).slice(0, RELATED_LIMIT + 1);
  return { rows, receivedCount, truncated: receivedCount > rows.length, missing: [] as string[] };
}

function trendScore(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100) return value;
  if (typeof value === "string" && /^\d{1,3}$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (parsed >= 0 && parsed <= 100) return parsed;
  }
  return null;
}

function readAverage(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0 || candidate > 100) return null;
  return candidate;
}

function shortLabel(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > 40) return null;
  return text;
}

function queryRows(list: unknown, roleLabel: string, noteFor: (raw: string | null, score: number | null) => string | null, cap: number, asTrend: boolean) {
  if (!Array.isArray(list)) return { rows: [] as DfsKeywordRow[], received: 0 };
  const rows: DfsKeywordRow[] = [];
  for (const item of list) {
    const record = asRecord(item);
    if (!record || typeof record.query !== "string" || !record.query.trim()) continue;
    const raw = shortLabel(record.value);
    const score = asTrend ? trendScore(record.value) : null;
    rows.push({
      ...emptyMetrics(record.query.trim(), roleLabel, noteFor(raw, score)),
      trendIndex: score,
    });
  }
  return { rows: rows.slice(0, cap), received: rows.length };
}

export function normalizeTrends(result: unknown, requested: string[]) {
  const root = Array.isArray(result) ? asRecord(result[0]) : null;
  const items = root && Array.isArray(root.items) ? root.items : [];
  const graph = items.map(asRecord).find((item) => item?.type === "google_trends_graph") ?? null;
  const queries = items.map(asRecord).find((item) => item?.type === "google_trends_queries_list") ?? null;
  const graphKeywords = graph && Array.isArray(graph.keywords) ? graph.keywords.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
  const keyword = graphKeywords[0]?.trim() || requested[0] || "";
  const average = graph ? readAverage(graph.averages) : null;
  const rows: DfsKeywordRow[] = [];
  if (keyword) {
    const zeroNote = average === 0 ? "0 表示这段时间热度数据不足，这是接口返回的 0，不是补的" : null;
    const missingNote = average == null ? "接口没有返回整段平均热度" : null;
    rows.push({
      ...emptyMetrics(keyword, "平均热度", joinNotes(["过去 12 个月网页搜索的平均相对热度，不是月搜索量", zeroNote, missingNote])),
      trendIndex: average,
    });
  }
  const data = asRecord(queries?.data);
  const top = queryRows(
    data?.top,
    "相关查询",
    (raw, score) => joinNotes(["相关查询的相对热度，不是月搜索量", score == null && raw ? `热度标注：${raw}` : null]),
    TRENDS_TOP_CAP,
    true,
  );
  const rising = queryRows(
    data?.rising,
    "上升查询",
    (raw) => joinNotes(["上升幅度不是 0–100 的热度指数，也不是月搜索量", raw ? `上升幅度：${raw}` : "接口没有给出上升幅度"]),
    TRENDS_RISING_CAP,
    false,
  );
  const receivedCount = (keyword ? 1 : 0) + top.received + rising.received;
  const merged = dedupe([...rows, ...top.rows, ...rising.rows]);
  return {
    rows: merged,
    receivedCount,
    truncated: top.received > top.rows.length || rising.received > rising.rows.length,
    missing: [] as string[],
  };
}

export function normalizeByMode(mode: DfsMode, result: unknown, requested: string[]) {
  switch (mode) {
    case "volume":
      return normalizeVolume(result, requested);
    case "ideas":
      return normalizeIdeas(result);
    case "related":
      return normalizeRelated(result);
    case "trends":
      return normalizeTrends(result, requested);
  }
}

function dig(root: unknown, path: string[]) {
  let current = root;
  for (const key of path) {
    const record = asRecord(current);
    if (!record || !(key in record)) return null;
    current = record[key];
  }
  return current;
}

function readLiveCost(node: unknown) {
  const record = asRecord(node);
  if (!record) return null;
  const normal = asRecord(record.priority_normal);
  if (normal && typeof normal.cost === "number" && Number.isFinite(normal.cost) && normal.cost >= 0) {
    return { cost: normal.cost, costType: typeof normal.cost_type === "string" ? normal.cost_type : null };
  }
  if (typeof record.cost === "number" && Number.isFinite(record.cost) && record.cost >= 0) {
    return { cost: record.cost, costType: typeof record.cost_type === "string" ? record.cost_type : null };
  }
  return null;
}

export function parseAccount(body: unknown) {
  const envelope = readEnvelope(body);
  const result = Array.isArray(envelope.result) ? asRecord(envelope.result[0]) : asRecord(envelope.result);
  if (!result) return null;
  const money = asRecord(result.money);
  const prices: DfsPriceQuote[] = DFS_MODES.map((mode) => {
    const quote = readLiveCost(dig(result.price, pricePath(mode.id)));
    return { mode: mode.id, label: mode.label, channel: mode.channel, cost: quote?.cost ?? null, costType: quote?.costType ?? null };
  });
  return { balance: metricOrNull(money?.balance), prices };
}
