import assert from "node:assert/strict";
import test from "node:test";
import { clearLookupCache } from "./cache";
import { DFS_MARKETS, presetForDesk } from "./constants";
import { explainDfsFailure } from "./messages";
import { normalizeByMode, normalizeTrends, parseAccount } from "./normalize";
import { executeAccount, executeLookup } from "./service";
import { hasCredentials, parseLookupInput } from "./validate";

const LOGIN = "desk-test-login";
const PASSWORD = "desk-test-password";

function envelope(result: unknown, cost = 0.075, code = 20000) {
  return {
    status_code: code,
    status_message: code === 20000 ? "Ok." : "Error.",
    cost,
    tasks: [{ status_code: code, status_message: "Ok.", cost, result }],
  };
}

test("markets map the same way as AnswerThePublic, and the Middle East is two countries", () => {
  const byId = Object.fromEntries(DFS_MARKETS.map((item) => [item.id, item]));
  assert.equal(byId.US.locationCode, 2840);
  assert.equal(byId.US.languageCode, "en");
  assert.equal(byId.UK.locationCode, 2826);
  assert.equal(byId.UK.languageCode, "en");
  assert.equal(byId.DE.locationCode, 2276);
  assert.equal(byId.DE.languageCode, "de");
  assert.equal(byId.AU.locationCode, 2036);
  assert.equal(byId.AU.languageCode, "en");
  assert.equal(byId.AE.locationCode, 2784);
  assert.equal(byId.AE.languageCode, "en");
  assert.equal(byId.SA.locationCode, 2682);
  assert.equal(byId.SA.languageCode, "ar");
  assert.equal(byId.JP.locationCode, 2392);
  assert.equal(byId.JP.languageCode, "ja");
  assert.equal(byId.ES.locationCode, 2724);
  assert.equal(byId.ES.languageCode, "es");
  assert.equal(byId.MX.locationCode, 2484);
  assert.equal(byId.MX.languageCode, "es");
  assert.equal(byId.IT.locationCode, 2380);
  assert.equal(byId.IT.languageCode, "it");
  assert.equal(byId.FR.locationCode, 2250);
  assert.equal(byId.FR.languageCode, "fr");
  assert.equal(byId.PT.locationCode, 2620);
  assert.equal(byId.PT.languageCode, "pt");
  assert.equal(byId.BR.locationCode, 2076);
  assert.equal(byId.BR.languageCode, "pt");
  assert.equal(byId.NL.locationCode, 2528);
  assert.equal(byId.NL.languageCode, "nl");
  assert.equal(byId.PL.locationCode, 2616);
  assert.equal(byId.PL.languageCode, "pl");
  assert.equal(byId.KR.locationCode, 2410);
  assert.equal(byId.KR.languageCode, "ko");
  assert.equal(DFS_MARKETS.some((item) => (item.id as string) === "ME"), false);
  assert.equal(presetForDesk("ME").id, "AE");
  assert.equal(presetForDesk("UK").locationCode, 2826);
  assert.equal(presetForDesk("JP").languageCode, "ja");
  assert.equal(presetForDesk("ES").locationCode, 2724);
  assert.equal(presetForDesk("MX").languageCode, "es");
  assert.equal(presetForDesk("KR").languageCode, "ko");
  assert.equal(presetForDesk("KR").locationCode, 2410);
});

test("lookup input rejects anything that would fan out or leave the mapped markets", () => {
  const base = { mode: "volume", marketId: "US", languageCode: "en", text: "silicone utensil" };
  assert.equal(parseLookupInput(base).ok, true);
  assert.equal(parseLookupInput({ ...base, text: "" }).ok, false);
  assert.match(parseLookupInput({ ...base, marketId: "ME" }).ok ? "" : (parseLookupInput({ ...base, marketId: "ME" }) as { message: string }).message, /阿联酋/);
  const many = Array.from({ length: 21 }, (_, index) => `word${index}`).join("\n");
  assert.match((parseLookupInput({ ...base, text: many }) as { message: string }).message, /20/);
  assert.match((parseLookupInput({ ...base, mode: "ideas", text: "cup, mug" }) as { message: string }).message, /一个/);
  assert.match((parseLookupInput({ ...base, text: "cup 😀" }) as { message: string }).message, /符号/);
  const shirt = parseLookupInput({ ...base, text: "men's t-shirt" });
  assert.equal(shirt.ok, true);
  const japan = parseLookupInput({ mode: "volume", marketId: "JP", languageCode: "ja", text: "ワイヤレスイヤホン" });
  assert.equal(japan.ok, true);
  const germany = parseLookupInput({ mode: "related", marketId: "DE", languageCode: "de", text: "Küchenhelfer" });
  assert.equal(germany.ok, true);
  const same = parseLookupInput({ ...base, text: "Foo, foo" });
  assert.equal(same.ok && same.value.keywords.length, 1);
});

test("measured numbers stay as returned, blanks stay null, and a later month is not averaged in", () => {
  const normalized = normalizeByMode("volume", [
    {
      keyword: "silicone utensil",
      search_volume: 100,
      cpc: 1.2,
      competition: "LOW",
      competition_index: 20,
      low_top_of_page_bid: 0.4,
      high_top_of_page_bid: 1.1,
      monthly_searches: [
        { year: 2025, month: 1, search_volume: 80 },
        { year: 2026, month: 10, search_volume: 50 },
      ],
    },
    { keyword: "empty metric", search_volume: null, cpc: null, competition: null, low_top_of_page_bid: null },
    { keyword: "zero metric", search_volume: 0, cpc: 0, competition: "HIGH" },
    { keyword: "negative", search_volume: -5, cpc: -1 },
  ], ["silicone utensil", "empty metric", "zero metric", "negative", "not returned"]);
  const byKeyword = Object.fromEntries(normalized.rows.map((row) => [row.keyword, row]));
  assert.equal(byKeyword["silicone utensil"].monthlySearches, 100);
  assert.equal(byKeyword["silicone utensil"].cpc, 1.2);
  assert.equal(byKeyword["silicone utensil"].competition, "低");
  assert.equal(byKeyword["silicone utensil"].bidLow, 0.4);
  assert.equal(byKeyword["silicone utensil"].bidCurrency, "USD");
  assert.match(byKeyword["silicone utensil"].note ?? "", /2026-10/);
  assert.match(byKeyword["silicone utensil"].note ?? "", /50/);
  assert.equal(byKeyword["empty metric"].monthlySearches, null);
  assert.equal(byKeyword["empty metric"].cpc, null);
  assert.equal(byKeyword["empty metric"].bidCurrency, null);
  assert.equal(byKeyword["zero metric"].monthlySearches, 0);
  assert.equal(byKeyword["zero metric"].cpc, 0);
  assert.equal(byKeyword["zero metric"].competition, "高");
  assert.equal(byKeyword.negative.monthlySearches, null);
  assert.equal(byKeyword.negative.cpc, null);
  assert.deepEqual(normalized.missing, ["not returned"]);
  assert.equal("not returned" in byKeyword, false);
});

test("ideas keep the highest volumes and do not turn null into zero", () => {
  const rows = Array.from({ length: 81 }, (_, index) => ({ keyword: `idea ${index}`, search_volume: index === 80 ? null : index }));
  const normalized = normalizeByMode("ideas", rows, ["seed"]);
  assert.equal(normalized.receivedCount, 81);
  assert.equal(normalized.truncated, true);
  assert.equal(normalized.rows.length, 80);
  assert.equal(normalized.rows[0].monthlySearches, 79);
  assert.equal(normalized.rows.at(-1)?.monthlySearches, 0);
  assert.equal(normalized.rows.some((row) => row.keyword === "idea 80"), false);
});

test("related keywords read keyword info and ignore clickstream fill-ins", () => {
  const normalized = normalizeByMode("related", [{
    seed_keyword_data: { keyword: "phone", keyword_info: { search_volume: 10, cpc: null, competition_level: "MEDIUM" } },
    items: [{
      keyword_data: {
        keyword: "phone case",
        keyword_info: { search_volume: null, cpc: 0.5 },
        clickstream_keyword_info: { search_volume: 999 },
      },
    }],
  }], ["phone"]);
  const byKeyword = Object.fromEntries(normalized.rows.map((row) => [row.keyword, row]));
  assert.equal(byKeyword.phone.monthlySearches, 10);
  assert.equal(byKeyword.phone.cpc, null);
  assert.equal(byKeyword.phone.competition, "中");
  assert.equal(byKeyword["phone case"].monthlySearches, null);
  assert.equal(byKeyword["phone case"].cpc, 0.5);
  assert.equal(JSON.stringify(normalized).includes("999"), false);
});

test("trends keep relative interest out of monthly searches", () => {
  const normalized = normalizeTrends([{
    items: [
      { type: "google_trends_graph", keywords: ["silicone utensil"], averages: [40], data: [{ values: [80] }] },
      {
        type: "google_trends_queries_list",
        data: {
          top: [{ query: "silicone spoon", value: "15" }, { query: "weird", value: "Breakout" }],
          rising: [{ query: "silicone trend", value: "250" }],
        },
      },
    ],
  }], ["silicone utensil"]);
  const byKeyword = Object.fromEntries(normalized.rows.map((row) => [row.keyword, row]));
  assert.equal(byKeyword["silicone utensil"].trendIndex, 40);
  assert.equal(byKeyword["silicone utensil"].monthlySearches, null);
  assert.equal(byKeyword["silicone spoon"].trendIndex, 15);
  assert.equal(byKeyword["silicone spoon"].monthlySearches, null);
  assert.equal(byKeyword.weird.trendIndex, null);
  assert.match(byKeyword.weird.note ?? "", /Breakout/);
  assert.equal(byKeyword["silicone trend"].trendIndex, null);
  assert.equal(byKeyword["silicone trend"].monthlySearches, null);
  assert.match(byKeyword["silicone trend"].note ?? "", /250/);

  const missingAverage = normalizeTrends([{ items: [{ type: "google_trends_graph", keywords: ["solo"], data: [{ values: [80] }] }] }], ["solo"]);
  assert.equal(missingAverage.rows[0].trendIndex, null);
  assert.equal(missingAverage.rows[0].monthlySearches, null);

  const zero = normalizeTrends([{ items: [{ type: "google_trends_graph", keywords: ["quiet"], averages: [0] }] }], ["quiet"]);
  assert.equal(zero.rows[0].trendIndex, 0);
  assert.match(zero.rows[0].note ?? "", /不是补的/);

  const tooHigh = normalizeTrends([{ items: [{ type: "google_trends_graph", keywords: ["hot"], averages: [101] }] }], ["hot"]);
  assert.equal(tooHigh.rows[0].trendIndex, null);
});

test("account view keeps the balance and live price, and drops the login", () => {
  const parsed = parseAccount({
    status_code: 20000,
    tasks: [{
      status_code: 20000,
      result: [{
        login: "should-not-leak@example.com",
        money: { balance: 12.5, total: 100 },
        price: {
          keywords_data: {
            google_ads: {
              search_volume: {
                live: { priority_normal: { cost_type: "per_request", cost: 0.075 } },
                task_post: { priority_normal: { cost: 0.05 } },
              },
            },
            google_trends: { explore: { live: { priority_normal: { cost_type: "per_request", cost: 0.009 } } } },
          },
          dataforseo_labs: { google: { related_keywords: { live: { priority_high: { cost: 1 } } } } },
        },
      }],
    }],
  });
  assert.equal(parsed?.balance, 12.5);
  assert.equal(parsed?.prices.find((item) => item.mode === "volume")?.cost, 0.075);
  assert.equal(parsed?.prices.find((item) => item.mode === "trends")?.cost, 0.009);
  assert.equal(parsed?.prices.find((item) => item.mode === "related")?.cost, null);
  assert.equal(parsed?.prices.find((item) => item.mode === "ideas")?.cost, null);
  assert.equal(JSON.stringify(parsed).includes("should-not-leak"), false);
});

test("plan, auth, billing and rate-limit errors stay in Chinese", () => {
  const auth = explainDfsFailure({ httpStatus: 401, body: { status_code: 40100 }, retryAfterHeader: null });
  assert.match(auth.message, /密码/);
  assert.equal(auth.code, "auth");
  const billing = explainDfsFailure({ httpStatus: 200, body: { status_code: 20000, tasks: [{ status_code: 40210 }] }, retryAfterHeader: null });
  assert.equal(billing.code, "billing");
  assert.match(billing.message, /余额/);
  const rate = explainDfsFailure({ httpStatus: 200, body: { status_code: 40202 }, retryAfterHeader: "30" });
  assert.equal(rate.code, "rate");
  assert.equal(rate.retryAfterSeconds, 30);
  assert.match(rate.message, /频率/);
  const duplicate = explainDfsFailure({ httpStatus: 200, body: { status_code: 40205 }, retryAfterHeader: null });
  assert.equal(duplicate.code, "duplicate");
  assert.match(duplicate.message, /重复/);
  const limit = explainDfsFailure({ httpStatus: 200, body: { status_code: 40203 }, retryAfterHeader: null });
  assert.match(limit.message, /费用上限/);
});

test("credentials need both values and never invent a password", () => {
  assert.equal(hasCredentials(undefined, undefined), null);
  assert.equal(hasCredentials("login", ""), null);
  assert.equal(hasCredentials("  ", "secret"), null);
  assert.deepEqual(hasCredentials(" login ", " secret "), { login: "login", password: "secret" });
});

test("a lookup is one live call, repeats reuse it, and secrets stay out of the result", async () => {
  clearLookupCache();
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const raw = typeof init?.body === "string" ? JSON.parse(init.body) as unknown : null;
    calls.push({ url, method: init?.method ?? "GET", body: raw });
    const authorization = new Headers(init?.headers).get("authorization") ?? "";
    assert.match(authorization, /^Basic /);
    assert.equal(Buffer.from(authorization.slice(6), "base64").toString("utf8"), `${LOGIN}:${PASSWORD}`);
    if (url.endsWith("/v3/keywords_data/google_ads/search_volume/live")) {
      return Response.json(envelope([
        { keyword: "cup", search_volume: null, cpc: null },
        { keyword: "mug", search_volume: 0, cpc: 0.2 },
      ], 0.075));
    }
    return Response.json({ status_code: 40400 }, { status: 404 });
  };
  const options = { login: LOGIN, password: PASSWORD, fetchImpl, now: () => Date.parse("2026-11-26T00:00:00.000Z") };
  const first = await executeLookup({ mode: "volume", marketId: "UK", languageCode: "en", text: "mug\ncup" }, options);
  assert.equal(first.body.ok, true);
  if (!first.body.ok) return;
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].url, /\/v3\/keywords_data\/google_ads\/search_volume\/live$/);
  assert.equal(Array.isArray(calls[0].body) && calls[0].body.length, 1);
  const task = (calls[0].body as Array<Record<string, unknown>>)[0];
  assert.deepEqual(task.keywords, ["cup", "mug"]);
  assert.equal(task.location_code, 2826);
  assert.equal(task.language_code, "en");
  assert.equal(task.search_partners, false);
  assert.equal(first.body.rows.find((row) => row.keyword === "cup")?.monthlySearches, null);
  assert.equal(first.body.rows.find((row) => row.keyword === "mug")?.monthlySearches, 0);
  assert.equal(first.body.charged, true);
  assert.equal(JSON.stringify(first.body).includes(PASSWORD), false);
  assert.equal(JSON.stringify(first.body).includes(LOGIN), false);

  const second = await executeLookup({ mode: "volume", marketId: "UK", languageCode: "en", text: "cup, mug" }, options);
  assert.equal(calls.length, 1);
  assert.equal(second.body.ok && second.body.reused, true);
  assert.equal(second.body.ok && second.body.charged, false);
  assert.match(second.body.ok ? second.body.message : "", /没有再扣/);

  const third = await executeLookup({ mode: "volume", marketId: "UK", languageCode: "en", text: "mug\ncup", refresh: true }, options);
  assert.equal(calls.length, 2);
  assert.equal(third.body.ok && third.body.reused, false);
});

test("each mode hits only its own live endpoint", async () => {
  clearLookupCache();
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push(String(input));
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Array<Record<string, unknown>> : [];
    const task = body[0] ?? {};
    if (String(input).includes("keywords_for_keywords")) {
      assert.deepEqual(task.keywords, ["phone"]);
      assert.equal(body.length, 1);
    }
    if (String(input).includes("related_keywords")) {
      assert.equal(task.keyword, "phone");
      assert.equal(task.depth, 1);
      assert.equal(task.limit, 20);
      assert.equal(task.include_serp_info, false);
      assert.equal("include_clickstream_data" in task, false);
    }
    if (String(input).includes("google_trends")) {
      assert.deepEqual(task.keywords, ["phone"]);
      assert.deepEqual(task.item_types, ["google_trends_graph", "google_trends_queries_list"]);
      assert.equal(task.time_range, "past_12_months");
      assert.equal(task.type, "web");
    }
    if (String(input).includes("related_keywords")) {
      return Response.json(envelope([{ seed_keyword: "phone", items: [] }]));
    }
    if (String(input).includes("google_trends")) {
      return Response.json(envelope([{ items: [{ type: "google_trends_graph", keywords: ["phone"], averages: [12] }] }]));
    }
    return Response.json(envelope([{ keyword: "phone", search_volume: 3, cpc: null }]));
  };
  const options = { login: LOGIN, password: PASSWORD, fetchImpl };
  await executeLookup({ mode: "ideas", marketId: "US", languageCode: "en", text: "phone" }, options);
  await executeLookup({ mode: "related", marketId: "AE", languageCode: "en", text: "phone" }, options);
  await executeLookup({ mode: "trends", marketId: "SA", languageCode: "ar", text: "phone" }, options);
  assert.deepEqual(calls.map((url) => url.replace("https://api.dataforseo.com", "")), [
    "/v3/keywords_data/google_ads/keywords_for_keywords/live",
    "/v3/dataforseo_labs/google/related_keywords/live",
    "/v3/keywords_data/google_trends/explore/live",
  ]);
  const trends = await executeLookup({ mode: "trends", marketId: "SA", languageCode: "ar", text: "phone" }, options);
  assert.equal(calls.length, 3);
  assert.equal(trends.body.ok && trends.body.rows[0]?.trendIndex, 12);
  assert.equal(trends.body.ok && trends.body.rows[0]?.monthlySearches, null);
  assert.equal(trends.body.ok && trends.body.locationCode, 2682);
});

test("missing credentials and invalid input do not call DataForSEO", async () => {
  clearLookupCache();
  let called = 0;
  const fetchImpl: typeof fetch = async () => {
    called += 1;
    return Response.json(envelope([]));
  };
  const missing = await executeLookup({ mode: "volume", marketId: "US", languageCode: "en", text: "cup" }, { login: LOGIN, password: null, fetchImpl });
  assert.equal(missing.body.ok, false);
  if (!missing.body.ok) assert.match(missing.body.message, /DATAFORSEO_LOGIN/);
  assert.equal(called, 0);
  const invalid = await executeLookup({ mode: "volume", marketId: "ME", languageCode: "en", text: "cup" }, { login: LOGIN, password: PASSWORD, fetchImpl });
  assert.equal(invalid.status, 400);
  assert.equal(called, 0);
  const account = await executeAccount({ login: null, password: null, fetchImpl });
  assert.equal(account.body.ok, false);
  assert.equal(called, 0);
});

test("account status is the free user endpoint and does not create a keyword task", async () => {
  clearLookupCache();
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    calls.push(String(input));
    return Response.json({
      status_code: 20000,
      cost: 0,
      tasks: [{ status_code: 20000, cost: 0, result: [{ login: LOGIN, money: { balance: 0 } }] }],
    });
  };
  const account = await executeAccount({ login: LOGIN, password: PASSWORD, fetchImpl });
  assert.equal(account.body.ok, true);
  if (account.body.ok) {
    assert.equal(account.body.keywordTask, false);
    assert.equal(account.body.balance, 0);
    assert.match(account.body.note, /没有创建关键字任务/);
  }
  assert.deepEqual(calls, ["https://api.dataforseo.com/v3/appendix/user_data"]);
  assert.equal(JSON.stringify(account.body).includes(LOGIN), false);
  assert.equal(JSON.stringify(account.body).includes(PASSWORD), false);
});

test("an auth failure is Chinese and does not invent rows", async () => {
  clearLookupCache();
  const fetchImpl: typeof fetch = async () => Response.json({ status_code: 40100, status_message: "Unauthorized." }, { status: 401 });
  const result = await executeLookup({ mode: "volume", marketId: "US", languageCode: "en", text: "cup" }, { login: LOGIN, password: PASSWORD, fetchImpl });
  assert.equal(result.body.ok, false);
  if (!result.body.ok) {
    assert.equal(result.body.code, "auth");
    assert.match(result.body.message, /密码/);
    assert.equal(JSON.stringify(result.body).includes(PASSWORD), false);
    assert.equal("rows" in result.body, false);
  }
});
