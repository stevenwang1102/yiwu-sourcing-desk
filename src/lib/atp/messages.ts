import type { QuotaView } from "./types";

export const MISSING_TOKEN_MESSAGE =
  "服务器还没有配置 ANSWERTHEPUBLIC_API_TOKEN。数据工位的粘贴录入照常可用。把令牌只放在服务器环境变量里，不要加 NEXT_PUBLIC_ 前缀，也不要写进仓库。";

export function formatReset(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function periodLabel(period: string | null) {
  if (period === "day") return "按日";
  if (period === "cycle") return "按计费周期";
  if (period === "month") return "按月";
  return "周期未知";
}

export function tierLabel(tier: string | null) {
  switch (tier) {
    case "t1":
      return "t1（入门）";
    case "t2":
      return "t2（成长）";
    case "t3":
      return "t3（商务）";
    case "restart":
      return "restart（旧版按月或按年）";
    case "lifetime":
      return "lifetime（终身）";
    default:
      return tier || "未知";
  }
}

export function quotaLine(kind: "搜索" | "读取", quota: QuotaView | null) {
  if (!quota) return `${kind}额度未知`;
  const reset = formatReset(quota.resetsAt);
  const resetText = reset ? `，预计 ${reset}（北京时间）恢复` : "";
  if (quota.limit == null && quota.remaining == null) {
    return `${kind}额度不限（${periodLabel(quota.period)}${resetText}）`;
  }
  const remaining = quota.remaining == null ? "未知" : quota.remaining.toLocaleString("zh-CN");
  const limit = quota.limit == null ? "未知" : quota.limit.toLocaleString("zh-CN");
  return `${kind}剩余 ${remaining} / ${limit}（${periodLabel(quota.period)}${resetText}）`;
}

const FIELD_LABELS: Record<string, string> = {
  keyword: "关键词",
  language: "语言",
  region: "地区",
  provider: "平台",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readReset(details: Record<string, unknown> | null) {
  const raw = details?.resets_at;
  return typeof raw === "string" ? raw : null;
}

function readRetry(details: Record<string, unknown> | null, header: string | null) {
  const fromHeader = header == null ? null : Number(header);
  if (fromHeader != null && Number.isFinite(fromHeader) && fromHeader >= 0) return Math.round(fromHeader);
  const raw = details?.retry_after;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.round(raw);
  return null;
}

function detailText(details: Record<string, unknown> | null) {
  if (!details) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (key === "billing_block" || key === "quota" || key === "used" || key === "remaining" || key === "period" || key === "resets_at" || key === "retry_after") {
      continue;
    }
    if (!Array.isArray(value)) continue;
    const text = value.filter((item) => typeof item === "string").join("，");
    if (!text) continue;
    parts.push(`${FIELD_LABELS[key] ?? key}：${text}`);
  }
  return parts.join(" ");
}

function quotaSentence(details: Record<string, unknown> | null) {
  if (!details) return "";
  const used = typeof details.used === "number" ? details.used : null;
  const quota = typeof details.quota === "number" ? details.quota : null;
  const period = typeof details.period === "string" ? periodLabel(details.period) : null;
  if (used == null && quota == null && !period) return "";
  const usage = used != null && quota != null ? `已用 ${used.toLocaleString("zh-CN")} / ${quota.toLocaleString("zh-CN")}` : "";
  return [usage, period].filter(Boolean).join("，");
}

export interface ExplainedFailure {
  code: string;
  message: string;
  resetsAt: string | null;
  retryAfterSeconds: number | null;
}

export function explainAtpFailure(input: { status: number; body: unknown; retryAfterHeader: string | null }): ExplainedFailure {
  const root = asRecord(input.body);
  const error = asRecord(root?.error) ?? root;
  const errorCode = typeof error?.error_code === "string" ? error.error_code : "";
  const english = typeof error?.message === "string" ? error.message : "";
  const details = asRecord(error?.details);
  const resetsAt = readReset(details);
  const retryAfterSeconds = readRetry(details, input.retryAfterHeader);
  const resetText = formatReset(resetsAt);
  const when = resetText
    ? `预计 ${resetText}（北京时间）后再试。`
    : retryAfterSeconds != null
      ? `请约 ${retryAfterSeconds.toLocaleString("zh-CN")} 秒后再试。`
      : "接口没有给出恢复时间，请稍后再试，不要立刻重试。";

  if (input.status === 401) {
    return {
      code: "unauthorized",
      message: "令牌无效、已撤销或已过期。请在 AnswerThePublic 账户里重新发放个人访问令牌，并只更新服务器上的 ANSWERTHEPUBLIC_API_TOKEN。",
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  if (errorCode === "ineligible_plan") {
    return {
      code: errorCode,
      message: "当前工作区没有可用的付费订阅（免费、已取消或已暂停），不能使用 AnswerThePublic API。",
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  if (errorCode === "lifetime_api_access") {
    return {
      code: errorCode,
      message: "终身版不含 API。需要改成月付或年付套餐后才能检索。",
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  if (errorCode === "trial_api_access") {
    return {
      code: errorCode,
      message: "试用还没转成付费订阅，暂时不能调用 API。转正后通常几分钟内恢复，最迟约六小时。",
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  if (errorCode === "unpaid_invoice") {
    return {
      code: errorCode,
      message: "有未付账单，API 已暂停。付清后通常几分钟内恢复，最迟约六小时。",
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  if (errorCode === "api_disabled") {
    const block = details?.billing_block;
    if (block === "trial") {
      return {
        code: errorCode,
        message: "API 开关是关的，而且订阅仍在试用，现在还开不了。试用转成付费后，再到账户 → API Access 里开启。",
        resetsAt: null,
        retryAfterSeconds: null,
      };
    }
    if (block === "unpaid_invoice") {
      return {
        code: errorCode,
        message: "API 开关是关的，而且有未付账单。先付清账单，再在账户 → API Access 里开启。",
        resetsAt: null,
        retryAfterSeconds: null,
      };
    }
    return {
      code: errorCode,
      message: "工作区没有打开 API。请到 AnswerThePublic 账户 → API Access 里开启。",
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  if (input.status === 403 && /workspace is locked/i.test(english)) {
    return {
      code: "workspace_locked",
      message: "工作区已被锁定。请联系 AnswerThePublic 支持或完成订阅。锁定期间读取和创建都会失败。",
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  const scope = /missing required scope:\s*([a-z:]+)/i.exec(english);
  if (input.status === 403 && scope) {
    return {
      code: "missing_scope",
      message: `令牌缺少权限 ${scope[1]}。创建检索需要 searches:write，查看进度需要 searches:read，读取报告需要 reports:read。`,
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  if (input.status === 403) {
    return {
      code: errorCode || "forbidden",
      message: "请求被拒绝。请检查套餐是否为已付款的月付或年付、API 是否已在账户里开启，以及令牌权限是否包含检索和报告。",
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  if (input.status === 404) {
    return {
      code: "not_found",
      message: "没有找到这次检索。编号可能不对，或它属于别的工作区。",
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  if (input.status === 422) {
    if (errorCode === "keyword_too_long") {
      return {
        code: errorCode,
        message: "关键词太长。走谷歌时，英语大约不能超过 91 个字符。请缩短后再查。这次没有创建检索。",
        resetsAt: null,
        retryAfterSeconds: null,
      };
    }
    const fields = detailText(details);
    return {
      code: errorCode || "invalid",
      message: fields
        ? `检索条件没有通过校验。${fields} 这次没有创建检索。`
        : "检索条件没有通过校验。请检查关键词、语言、地区和平台。这次没有创建检索。",
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  if (input.status === 429 && errorCode === "read_quota_exceeded") {
    const usage = quotaSentence(details);
    return {
      code: errorCode,
      message: `今日读取额度已用完${usage ? `（${usage}）` : ""}。读取已完成的报告会计入这个额度，搜索额度是另一笔。${when}`,
      resetsAt,
      retryAfterSeconds,
    };
  }

  if (input.status === 429 && details && (english.toLowerCase().includes("search limit") || "quota" in details || "remaining" in details)) {
    const usage = quotaSentence(details);
    return {
      code: "search_quota",
      message: `搜索额度已用完${usage ? `（${usage}）` : ""}。${when}在恢复前，用同一个关键词、语言和地区再点一次也只会复用 24 小时内已有的检索。`,
      resetsAt,
      retryAfterSeconds,
    };
  }

  if (input.status === 429) {
    return {
      code: "rate_limit",
      message: `请求过于频繁。${when}`,
      resetsAt,
      retryAfterSeconds,
    };
  }

  if (input.status >= 500) {
    return {
      code: "upstream",
      message: `AnswerThePublic 暂时出错（${input.status}）。这次没有把任何数字写成实测。可以过一会儿再试。`,
      resetsAt: null,
      retryAfterSeconds: null,
    };
  }

  return {
    code: errorCode || "upstream",
    message: `AnswerThePublic 返回了未能识别的状态（${input.status}）。这次没有把结果写成实测。`,
    resetsAt: null,
    retryAfterSeconds: null,
  };
}

const INTENT_LABELS: Record<string, string> = {
  informational: "信息",
  commercial: "商业",
  transactional: "交易",
  navigational: "导航",
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: "正向",
  neutral: "中性",
  negative: "负向",
};

export function intentLabel(value: string | null) {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return INTENT_LABELS[key] ? `${INTENT_LABELS[key]}（${value}）` : value;
}

export function sentimentLabel(value: string | null) {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return SENTIMENT_LABELS[key] ? `${SENTIMENT_LABELS[key]}（${value}）` : value;
}
