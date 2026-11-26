import type { Customer, KeywordOrigin, MeasuredKeyword } from "./types";

export const KEYWORD_ORIGINS: { id: KeywordOrigin; label: string; hint: string }[] = [
  { id: "answerthepublic", label: "AnswerThePublic", hint: "数据工位检索后写入" },
  { id: "dataforseo", label: "DataForSEO", hint: "数据工位检索后写入" },
  { id: "keyword-planner", label: "关键字规划师", hint: "粘贴导出表" },
  { id: "google-trends", label: "Google Trends", hint: "粘贴相对热度，不是月搜索量" },
  { id: "manual", label: "手动录入", hint: "只记词，不填写搜索量" },
  { id: "custom", label: "自定义", hint: "上面几项都对不上时自己标明" },
];

const ORIGIN_IDS = new Set<KeywordOrigin>(KEYWORD_ORIGINS.map((item) => item.id));

/** 手写进词库时允许自选的来源。工具来源由对应的写入动作自动带上。 */
export const HAND_ORIGINS: KeywordOrigin[] = ["manual", "custom"];

export function isKeywordOrigin(value: unknown): value is KeywordOrigin {
  return typeof value === "string" && ORIGIN_IDS.has(value as KeywordOrigin);
}

export function originLabel(origin: KeywordOrigin) {
  return KEYWORD_ORIGINS.find((item) => item.id === origin)?.label ?? "自定义";
}

export function inferOrigin(source: string): KeywordOrigin {
  const text = source.toLowerCase();
  if (text.includes("answerthepublic")) return "answerthepublic";
  if (text.includes("dataforseo")) return "dataforseo";
  if (text.includes("trend")) return "google-trends";
  if (text.includes("planner") || text.includes("规划师")) return "keyword-planner";
  if (text.includes("手动")) return "manual";
  if (text.includes("自定义") || text.includes("custom")) return "custom";
  return "custom";
}

export function assignCustomerPhrase(customers: Customer[], id: string | null) {
  if (!id) return "未指定客户";
  return customers.find((item) => item.id === id)?.name ?? "未指定客户";
}

/** 空着是未知。数字 0 保持 0，不用未知冒充。 */
export function formatMetric(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "未知";
  return String(value);
}

export function keywordStatus(row: Pick<MeasuredKeyword, "origin" | "monthlySearches" | "competition" | "bidLow" | "bidHigh" | "trendIndex" | "cpc">): "measured" | "unknown" {
  if (row.origin === "manual" || row.origin === "custom") {
    const hasNumber = row.monthlySearches != null || row.trendIndex != null || row.cpc != null || row.bidLow != null || row.bidHigh != null;
    const hasCompetition = row.competition != null && row.competition.trim() !== "";
    return hasNumber || hasCompetition ? "measured" : "unknown";
  }
  return "measured";
}

export function formatUpdated(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "未知";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function normalizeCustomers(raw: unknown): Customer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const customers: Customer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<Customer>;
    const id = asText(row.id).trim();
    const name = asText(row.name).trim().slice(0, 40);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    customers.push({
      id,
      name,
      createdAt: asText(row.createdAt) || new Date(0).toISOString(),
    });
  }
  return customers;
}

export function normalizeMeasured(raw: unknown, customerIds: Set<string>): MeasuredKeyword[] {
  if (!Array.isArray(raw)) return [];
  const rows: MeasuredKeyword[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as Partial<MeasuredKeyword>;
    const keyword = asText(row.keyword).trim();
    if (!keyword) return;
    const source = asText(row.source).trim() || "自定义";
    const origin = isKeywordOrigin(row.origin) ? row.origin : inferOrigin(source);
    const customerId = typeof row.customerId === "string" && customerIds.has(row.customerId) ? row.customerId : null;
    rows.push({
      id: asText(row.id).trim() || `kw-legacy-${index}`,
      keyword,
      monthlySearches: asNumber(row.monthlySearches),
      competition: asText(row.competition).trim() || null,
      bidLow: asNumber(row.bidLow),
      bidHigh: asNumber(row.bidHigh),
      bidCurrency: asText(row.bidCurrency).trim() || null,
      trendIndex: asNumber(row.trendIndex),
      cpc: asNumber(row.cpc),
      atpBucket: asText(row.atpBucket).trim() || null,
      source,
      origin,
      customerId,
      pastedAt: asText(row.pastedAt) || new Date(0).toISOString(),
      productId: asText(row.productId).trim() || null,
      note: asText(row.note),
    });
  });
  return rows;
}
