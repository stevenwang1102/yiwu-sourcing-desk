import type { AccountView, ParentView, PollView, QuotaView, RateHint } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integer(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function unwrap(json: unknown) {
  const root = asRecord(json);
  return asRecord(root?.data) ?? root;
}

export function parseQuota(value: unknown): QuotaView | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    period: text(record.period),
    limit: integer(record.limit),
    remaining: integer(record.remaining),
    used: integer(record.used),
    resetsAt: text(record.resets_at),
  };
}

export function parseAccount(json: unknown): AccountView | null {
  const data = unwrap(json);
  if (!data) return null;
  const workspace = asRecord(data.workspace);
  const quota = asRecord(data.quota);
  if (!workspace && !quota) return null;
  return {
    workspaceName: text(workspace?.name),
    tier: text(workspace?.atp_tier),
    apiVersion: text(data.api_version),
    searches: parseQuota(quota?.searches),
    reads: parseQuota(quota?.reads),
  };
}

export function parseParentSearch(json: unknown, now = Date.now()): ParentView | null {
  const data = unwrap(json);
  if (!data) return null;
  const parentSearchId = text(data.parent_search_id);
  if (!parentSearchId) return null;
  const searches = Array.isArray(data.searches) ? data.searches : [];
  const createdAt = text(data.created_at);
  const createdMs = createdAt ? Date.parse(createdAt) : Number.NaN;
  return {
    parentSearchId,
    keyword: text(data.keyword) ?? "",
    language: text(data.language) ?? "",
    region: text(data.region) ?? "",
    status: text(data.status) ?? "pending",
    createdAt,
    reused: Number.isFinite(createdMs) && now - createdMs > 90_000,
    searches: searches.flatMap((item) => {
      const record = asRecord(item);
      const id = text(record?.id);
      if (!record || !id) return [];
      return [{ id, provider: text(record.provider) ?? "unknown", status: text(record.status) ?? "loading" }];
    }),
  };
}

export function parsePoll(json: unknown, fallbackId: string): PollView | null {
  const data = unwrap(json);
  if (!data) return null;
  const search = asRecord(data.search);
  const snapshot = asRecord(data.snapshot);
  const suggested = asRecord(snapshot?.suggested_keyword);
  const status = text(data.status) ?? text(search?.status);
  if (!status && !search) return null;
  return {
    id: text(search?.id) ?? fallbackId,
    status: status ?? "loading",
    provider: text(search?.provider),
    keyword: text(search?.keyword),
    collectionOutcome: text(snapshot?.collection_outcome),
    suggestedKeyword: suggested ? text(suggested.keyword) : null,
    suggestedType: suggested ? text(suggested.type) : null,
  };
}

export function readRateHint(headers: { get(name: string): string | null }): RateHint {
  return {
    limit: integer(headers.get("ratelimit-limit") ?? headers.get("RateLimit-Limit")),
    remaining: integer(headers.get("ratelimit-remaining") ?? headers.get("RateLimit-Remaining")),
    resetSeconds: integer(headers.get("ratelimit-reset") ?? headers.get("RateLimit-Reset")),
  };
}

export function rateHintOrNull(hint: RateHint) {
  if (hint.limit == null && hint.remaining == null && hint.resetSeconds == null) return null;
  return hint;
}
