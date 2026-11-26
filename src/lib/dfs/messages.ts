export const MISSING_CREDENTIALS_MESSAGE =
  "服务器还没有配好 DataForSEO。请在服务器环境变量里同时填写 DATAFORSEO_LOGIN 和 DATAFORSEO_PASSWORD（API 登录名和 API 密码）。不要加 NEXT_PUBLIC_ 前缀，不要写进仓库，也不要只填其中一个。配好之前，粘贴录入和 AnswerThePublic 仍可使用。打开本页不会创建关键字任务。";

export interface ExplainedFailure {
  code: string;
  message: string;
  retryAfterSeconds: number | null;
  httpStatus: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readCode(body: unknown) {
  const root = asRecord(body);
  if (!root) return null;
  const task = Array.isArray(root.tasks) ? asRecord(root.tasks[0]) : null;
  const taskCode = typeof task?.status_code === "number" ? task.status_code : null;
  const topCode = typeof root.status_code === "number" ? root.status_code : null;
  if (taskCode != null && taskCode !== 20000) return taskCode;
  return topCode;
}

function retryAfter(header: string | null) {
  if (header == null) return null;
  const value = Number(header);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function withCode(message: string, code: number | null) {
  return code == null ? message : `${message}（代码 ${code}）`;
}

export function explainDfsFailure(input: { httpStatus: number; body: unknown; retryAfterHeader: string | null }): ExplainedFailure {
  const internal = readCode(input.body);
  const wait = retryAfter(input.retryAfterHeader);
  const code = internal ?? (input.httpStatus >= 400 ? input.httpStatus : null);

  if (input.httpStatus === 401 || internal === 40100) {
    return {
      code: "auth",
      httpStatus: 401,
      retryAfterSeconds: wait,
      message: withCode("DataForSEO 没有接受这对登录名和 API 密码。请核对服务器上的 DATAFORSEO_LOGIN 和 DATAFORSEO_PASSWORD。不要把密码写进网页或仓库。这次没有拿到关键字数据。", code),
    };
  }
  if (internal === 40104) {
    return {
      code: "unverified",
      httpStatus: 403,
      retryAfterSeconds: wait,
      message: withCode("DataForSEO 账户还没完成验证。请先在他们的用户面板里完成验证。这次没有查词。", code),
    };
  }
  if (internal === 40201) {
    return {
      code: "paused",
      httpStatus: 402,
      retryAfterSeconds: wait,
      message: withCode("DataForSEO 暂停了这个账户。请联系他们的支持。这次没有拿到关键字数据。", code),
    };
  }
  if (input.httpStatus === 402 || internal === 40200 || internal === 40210) {
    return {
      code: "billing",
      httpStatus: 402,
      retryAfterSeconds: wait,
      message: withCode("DataForSEO 账户余额不足，或这次费用没能扣成功。请到账户里查看余额。这次没有把空表写成实测。", code),
    };
  }
  if (internal === 40202 || internal === 40209) {
    return {
      code: "rate",
      httpStatus: 429,
      retryAfterSeconds: wait,
      message: withCode("请求太频繁，触发了 DataForSEO 的频率或并发限制。请过一会儿再查一次，不要连续重试。", code),
    };
  }
  if (internal === 40203) {
    return {
      code: "cost_limit",
      httpStatus: 429,
      retryAfterSeconds: wait,
      message: withCode("已达到 DataForSEO 账户里的费用上限。请到后台调整上限后再查。这次没有拿到新的关键字数据。", code),
    };
  }
  if (internal === 40205 || internal === 40206) {
    return {
      code: "duplicate",
      httpStatus: 429,
      retryAfterSeconds: wait,
      message: withCode("相同条件的任务在短时间内重复次数达到了 DataForSEO 的上限。请改用页面上已有的结果，或稍后再试。这次没有新的实测数字。", code),
    };
  }
  if (internal === 40207) {
    return {
      code: "whitelist",
      httpStatus: 403,
      retryAfterSeconds: wait,
      message: withCode("当前服务器 IP 不在 DataForSEO 的白名单里。请到账户的 API 访问设置里放行，或关掉 IP 限制。这次没有查词。", code),
    };
  }
  if (internal === 40501 || internal === 40503 || internal === 40506 || internal === 40000) {
    return {
      code: "invalid",
      httpStatus: 400,
      retryAfterSeconds: null,
      message: withCode("DataForSEO 不接受这次的参数。请缩短关键词、去掉特殊符号后再试。这次没有把空表写成实测。", code),
    };
  }
  if (internal === 50301) {
    return {
      code: "upstream",
      httpStatus: 502,
      retryAfterSeconds: wait,
      message: withCode("DataForSEO 的上游（例如 Google Ads 或 Google Trends）暂时不可用。这次没有把空表写成实测。", code),
    };
  }
  if (internal === 50303 || internal === 50304) {
    return {
      code: "unavailable",
      httpStatus: 503,
      retryAfterSeconds: wait,
      message: withCode("这个接口暂时不可用。请稍后再试。这次没有写成实测。", code),
    };
  }
  if (internal === 50401 || input.httpStatus === 504) {
    return {
      code: "timeout",
      httpStatus: 504,
      retryAfterSeconds: wait,
      message: withCode("实时查询超时。如果任务其实已经受理，相同条件马上再点可能被算作重复任务。请先看余额，不要连续重试。", code),
    };
  }
  if (input.httpStatus >= 500 || internal === 50000 || internal === 50001) {
    return {
      code: "internal",
      httpStatus: 502,
      retryAfterSeconds: wait,
      message: withCode("DataForSEO 内部出错。请稍后再试。这次没有写成实测。", code),
    };
  }
  return {
    code: "upstream",
    httpStatus: input.httpStatus >= 400 ? input.httpStatus : 502,
    retryAfterSeconds: wait,
    message: withCode("DataForSEO 没有返回可用结果。这次没有把空表写成实测。", code),
  };
}
