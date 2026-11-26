import { clearLookupCache, storeLookup, takeCachedLookup } from "./cache";
import { endpointPath, modeById } from "./constants";
import { MISSING_CREDENTIALS_MESSAGE, explainDfsFailure } from "./messages";
import { normalizeByMode, parseAccount, readEnvelope } from "./normalize";
import type { DfsAccountResponse, DfsLookupResponse, DfsPublicError } from "./types";
import { hasCredentials, parseLookupInput } from "./validate";

const ORIGIN = "https://api.dataforseo.com";

export interface ServiceOptions {
  login: string | null;
  password: string | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

function failure(configured: boolean, explained: ReturnType<typeof explainDfsFailure>): { status: number; body: DfsPublicError } {
  return {
    status: explained.httpStatus,
    body: {
      ok: false,
      configured,
      code: explained.code,
      message: explained.message,
      retryAfterSeconds: explained.retryAfterSeconds,
    },
  };
}

function missingCredentials(): { status: number; body: DfsPublicError } {
  return {
    status: 200,
    body: {
      ok: false,
      configured: false,
      code: "missing_token",
      message: MISSING_CREDENTIALS_MESSAGE,
      retryAfterSeconds: null,
    },
  };
}

function accountScope(login: string) {
  let hash = 0;
  for (const char of login) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(16);
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function callApi(options: ServiceOptions, path: string, init: { method: "GET" | "POST"; body?: unknown; timeoutMs: number }) {
  const login = options.login ?? "";
  const password = options.password ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${ORIGIN}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${login}:${password}`, "utf8").toString("base64")}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(init.timeoutMs),
    });
  } catch {
    return {
      ok: false as const,
      result: failure(true, {
        code: "network",
        httpStatus: 502,
        retryAfterSeconds: null,
        message: "连不上 DataForSEO，或请求超时。这次没有把结果写成实测。如果请求其实已经受理，相同条件短时间内再试可能被算作重复任务。",
      }),
    };
  }
  const body = await readJson(response);
  return { ok: true as const, response, body };
}

function rejectEnvelope(httpStatus: number, body: unknown, retryAfterHeader: string | null) {
  return failure(true, explainDfsFailure({ httpStatus, body, retryAfterHeader }));
}

export async function executeAccount(options: ServiceOptions) {
  const creds = hasCredentials(options.login ?? undefined, options.password ?? undefined);
  if (!creds) return missingCredentials();
  const called = await callApi({ ...options, login: creds.login, password: creds.password }, "/v3/appendix/user_data", { method: "GET", timeoutMs: 20_000 });
  if (!called.ok) return called.result;
  const envelope = readEnvelope(called.body);
  if (called.response.status !== 200 || (envelope.topCode != null && envelope.topCode !== 20000) || (envelope.taskCode != null && envelope.taskCode !== 20000)) {
    return rejectEnvelope(called.response.status, called.body, called.response.headers.get("retry-after"));
  }
  const account = parseAccount(called.body);
  if (!account) {
    return failure(true, {
      code: "bad_payload",
      httpStatus: 502,
      retryAfterSeconds: null,
      message: "账户接口有响应，但没有读到账户信息。这次没有创建关键字任务。",
    });
  }
  const payload: DfsAccountResponse = {
    ok: true,
    configured: true,
    keywordTask: false,
    balance: account.balance,
    prices: account.prices,
    note: "这次只请求了不计费的账户接口，没有创建关键字任务，也没有扣搜索量、建议词、相关词或趋势的查询费。",
  };
  return { status: 200, body: payload };
}

function costText(cost: number | null) {
  if (cost == null) return "接口没有标明本次费用，不要把它当成 0";
  return `接口标明本次费用 $${cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function successMessage(modeLabel: string, channel: string, count: number, missing: number, truncated: boolean, received: number, cost: number | null) {
  const missingText = missing > 0 ? ` 有 ${missing} 个词没有返回，这些词不会出现在表里，也不能当成搜索量 0。` : "";
  const truncatedText = truncated ? ` 接口返回 ${received} 条，这里只保留 ${count} 条。没留下的不是搜索量 0。` : "";
  return `${channel}返回 ${count} 条。标为实测，来源 DataForSEO · ${modeLabel}。接口没给的格子保持未知。${costText(cost)}。${missingText}${truncatedText}`.replace(/\s+/g, " ").trim();
}

function markReused(body: DfsLookupResponse): DfsLookupResponse {
  const note = "服务器在最近 6 小时内已有完全相同的市场、语言、查询类型和关键词，这次交回那份结果，没有再次请求 DataForSEO，因此没有再扣查询费。";
  return {
    ...body,
    reused: true,
    charged: false,
    cost: null,
    reuseNote: note,
    message: `${note}${body.message}`,
  };
}

function taskBody(parsed: ReturnType<typeof parseLookupInput> & { ok: true }) {
  const { mode, locationCode, languageCode, keywords } = parsed.value;
  const sent = [...keywords].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), "en"));
  if (mode === "related") {
    return [{
      keyword: sent[0],
      location_code: locationCode,
      language_code: languageCode,
      depth: 1,
      limit: 20,
      include_seed_keyword: true,
      include_serp_info: false,
      tag: "yiwu-sourcing-desk",
    }];
  }
  if (mode === "trends") {
    return [{
      keywords: sent,
      location_code: locationCode,
      language_code: languageCode,
      type: "web",
      time_range: "past_12_months",
      item_types: ["google_trends_graph", "google_trends_queries_list"],
      tag: "yiwu-sourcing-desk",
    }];
  }
  return [{
    keywords: sent,
    location_code: locationCode,
    language_code: languageCode,
    search_partners: false,
    sort_by: "search_volume",
    tag: "yiwu-sourcing-desk",
  }];
}

export async function executeLookup(raw: unknown, options: ServiceOptions) {
  const creds = hasCredentials(options.login ?? undefined, options.password ?? undefined);
  if (!creds) return missingCredentials();
  const parsed = parseLookupInput(raw);
  if (!parsed.ok) {
    return failure(true, { code: "invalid", httpStatus: 400, retryAfterSeconds: null, message: parsed.message });
  }
  const scope = accountScope(creds.login);
  const now = options.now?.() ?? Date.now();
  if (!parsed.value.refresh) {
    const cached = takeCachedLookup(scope, parsed.value.cacheKey, now);
    if (cached) return { status: 200, body: markReused(cached) };
  }
  const spec = modeById(parsed.value.mode);
  if (!spec) {
    return failure(true, { code: "invalid", httpStatus: 400, retryAfterSeconds: null, message: "不认识这种查询。这次没有向 DataForSEO 发请求。" });
  }
  const called = await callApi(
    { ...options, login: creds.login, password: creds.password },
    endpointPath(parsed.value.mode),
    { method: "POST", body: taskBody(parsed), timeoutMs: 110_000 },
  );
  if (!called.ok) return called.result;
  const envelope = readEnvelope(called.body);
  const noResults = envelope.topCode === 40102 || envelope.taskCode === 40102;
  if (!noResults && (called.response.status !== 200 || envelope.topCode !== 20000 || (envelope.taskCode != null && envelope.taskCode !== 20000))) {
    return rejectEnvelope(called.response.status, called.body, called.response.headers.get("retry-after"));
  }
  const normalized = noResults
    ? { rows: [], receivedCount: 0, truncated: false, missing: parsed.value.keywords }
    : normalizeByMode(parsed.value.mode, envelope.result, parsed.value.keywords);
  const message = noResults
    ? `这一档没有返回结果。没有把搜索量或热度写成 0。${costText(envelope.cost)}。`
    : successMessage(spec.label, spec.channel, normalized.rows.length, normalized.missing.length, normalized.truncated, normalized.receivedCount, envelope.cost);
  const payload: DfsLookupResponse = {
    ok: true,
    mode: parsed.value.mode,
    modeLabel: spec.label,
    channel: spec.channel,
    marketId: parsed.value.marketId,
    locationCode: parsed.value.locationCode,
    locationLabel: parsed.value.locationLabel,
    languageCode: parsed.value.languageCode,
    languageLabel: parsed.value.languageLabel,
    keywords: parsed.value.keywords,
    rows: normalized.rows,
    truncated: normalized.truncated,
    receivedCount: normalized.receivedCount,
    reused: false,
    reuseNote: null,
    cost: envelope.cost,
    charged: true,
    message,
    fetchedAt: new Date(now).toISOString(),
    cacheKey: parsed.value.cacheKey,
  };
  storeLookup(scope, parsed.value.cacheKey, payload, now);
  return { status: 200, body: payload };
}

export { clearLookupCache };
