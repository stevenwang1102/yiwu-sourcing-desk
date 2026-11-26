import "server-only";

import { connection } from "next/server";
import { quotaLine, tierLabel, MISSING_TOKEN_MESSAGE, explainAtpFailure } from "./messages";
import { normalizeReport } from "./normalize";
import { parseAccount, parseParentSearch, parsePoll, rateHintOrNull, readRateHint } from "./interpret";
import type { AtpAccountResponse, AtpProgressResponse, AtpPublicError, AtpReportResponse, AtpSearchResponse } from "./types";
import { buildSearchBody, validateIds, validateReportId, validateSearchInput } from "./validate";

const ATP_ORIGIN = "https://api.answerthepublic.com";

async function readToken() {
  await connection();
  const value = process.env.ANSWERTHEPUBLIC_API_TOKEN;
  if (typeof value !== "string") return null;
  const token = value.trim();
  return token.length ? token : null;
}

function failure(status: number, explained: ReturnType<typeof explainAtpFailure>, configured: boolean): { status: number; body: AtpPublicError } {
  return {
    status,
    body: {
      ok: false,
      configured,
      code: explained.code,
      message: explained.message,
      resetsAt: explained.resetsAt,
      retryAfterSeconds: explained.retryAfterSeconds,
    },
  };
}

export function missingTokenResult(): { status: number; body: AtpPublicError } {
  return {
    status: 200,
    body: {
      ok: false,
      configured: false,
      code: "missing_token",
      message: MISSING_TOKEN_MESSAGE,
      resetsAt: null,
      retryAfterSeconds: null,
    },
  };
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

async function atp(path: string, init: { method: "GET" | "POST"; token: string; body?: unknown }) {
  let response: Response;
  try {
    response = await fetch(`${ATP_ORIGIN}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${init.token}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return {
      ok: false as const,
      result: failure(502, {
        code: "network",
        message: "连不上 AnswerThePublic，或请求超时。这次没有把结果写成实测。如果刚才那次检索其实已经创建，24 小时内用同一个关键词、语言和地区再查会复用，不会重复扣搜索额度。",
        resetsAt: null,
        retryAfterSeconds: null,
      }, true),
    };
  }
  const body = await readJson(response);
  if (!response.ok) {
    return {
      ok: false as const,
      result: failure(response.status, explainAtpFailure({
        status: response.status,
        body,
        retryAfterHeader: response.headers.get("retry-after"),
      }), true),
    };
  }
  return { ok: true as const, response, body };
}

export async function getAccount() {
  const token = await readToken();
  if (!token) return missingTokenResult();
  const result = await atp("/api/public/v1/me", { method: "GET", token });
  if (!result.ok) return result.result;
  const account = parseAccount(result.body);
  if (!account) {
    return failure(502, {
      code: "bad_payload",
      message: "额度接口有响应，但没有读到工作区信息。这次没有创建检索。",
      resetsAt: null,
      retryAfterSeconds: null,
    }, true);
  }
  const body: AtpAccountResponse = {
    ok: true,
    configured: true,
    workspaceName: account.workspaceName,
    tier: account.tier,
    tierLabel: tierLabel(account.tier),
    apiVersion: account.apiVersion,
    searches: account.searches,
    reads: account.reads,
    searchesLine: quotaLine("搜索", account.searches),
    readsLine: quotaLine("读取", account.reads),
    note: "这次只做了健康检查，没有创建检索，也没有扣搜索额度。套餐标签只作显示；能读到这里，说明当前令牌这次检查通过了。",
  };
  return { status: 200, body };
}

export async function createSearch(raw: unknown) {
  const parsed = validateSearchInput(raw);
  if (!parsed.ok) {
    return failure(400, { code: "invalid", message: parsed.message, resetsAt: null, retryAfterSeconds: null }, true);
  }
  const token = await readToken();
  if (!token) return missingTokenResult();
  const result = await atp("/api/public/v1/searches", {
    method: "POST",
    token,
    body: buildSearchBody(parsed.value),
  });
  if (!result.ok) return result.result;
  const parent = parseParentSearch(result.body);
  if (!parent) {
    return failure(502, {
      code: "bad_payload",
      message: "检索接口有响应，但没有返回检索编号。请先点继续查看或到 AnswerThePublic 后台确认，不要立刻再用同一个词重试。",
      resetsAt: null,
      retryAfterSeconds: null,
    }, true);
  }
  const reusedNote = parent.reused
    ? "24 小时内已有相同关键词、语言和地区的检索，接口复用了它，这次没有再扣搜索额度。"
    : parsed.value.provider
      ? "已创建检索，只跑选定的一个平台，会计入搜索额度。"
      : "已创建检索，并按全部平台展开。每个平台各算一次额度；24 小时内相同关键词、语言和地区会复用。";
  const body: AtpSearchResponse = {
    ok: true,
    parentSearchId: parent.parentSearchId,
    keyword: parent.keyword || parsed.value.keyword,
    language: parent.language || parsed.value.language,
    region: parent.region || parsed.value.region,
    status: parent.status,
    reused: parent.reused,
    message: reusedNote,
    searches: parent.searches,
    rate: rateHintOrNull(readRateHint(result.response.headers)),
  };
  return { status: 201, body };
}

export async function pollSearches(raw: unknown) {
  const parsed = validateIds(raw);
  if (!parsed.ok) {
    return failure(400, { code: "invalid", message: parsed.message, resetsAt: null, retryAfterSeconds: null }, true);
  }
  const token = await readToken();
  if (!token) return missingTokenResult();
  const searches: AtpProgressResponse["searches"] = [];
  for (const id of parsed.ids) {
    const result = await atp(`/api/public/v1/searches/${id}`, { method: "GET", token });
    if (!result.ok) return result.result;
    const poll = parsePoll(result.body, id);
    if (!poll) {
      return failure(502, {
        code: "bad_payload",
        message: "进度接口有响应，但没有读到状态。这次没有把空表写成实测。",
        resetsAt: null,
        retryAfterSeconds: null,
      }, true);
    }
    searches.push(poll);
  }
  const body: AtpProgressResponse = { ok: true, searches };
  return { status: 200, body };
}

export async function getReport(id: string, query: { page: number; grouped: boolean; provider: string | null }) {
  if (!validateReportId(id)) {
    return failure(400, { code: "invalid", message: "报告编号不正确，没有向 AnswerThePublic 读取。", resetsAt: null, retryAfterSeconds: null }, true);
  }
  const token = await readToken();
  if (!token) return missingTokenResult();
  const params = new URLSearchParams({
    grouped: query.grouped ? "true" : "false",
    page: String(query.page),
    per_page: "200",
    sort_by: "volume",
    sort_order: "desc",
  });
  if (query.provider) params.set("providers", query.provider);
  const result = await atp(`/api/public/v1/reports/${id}?${params.toString()}`, { method: "GET", token });
  if (!result.ok) return result.result;
  const report = normalizeReport(result.body);
  const body: AtpReportResponse = {
    ok: true,
    parentSearchId: id,
    page: query.page,
    perPage: 200,
    grouped: query.grouped,
    ...report,
  };
  return { status: 200, body };
}
