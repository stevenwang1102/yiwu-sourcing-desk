import assert from "node:assert/strict";
import test from "node:test";
import { MISSING_TOKEN_MESSAGE, explainAtpFailure, formatReset } from "./messages";
import { normalizeReport } from "./normalize";
import { parseParentSearch, readRateHint } from "./interpret";
import { buildSearchBody, validateSearchInput } from "./validate";

test("grouped report keeps measured numbers and leaves blanks unknown", () => {
  const report = normalizeReport({
    data: {
      sources: [
        {
          source: "questions",
          modifiers: [
            {
              name: "can",
              suggestions: [
                { keyword: "can silicone utensils go in the dishwasher", search_volume: 720, cost_per_click: 1.2, intent: "informational", sentiment: "neutral" },
                { keyword: "can silicone utensils melt", search_volume: null, cost_per_click: null },
                { keyword: "can silicone utensils scratch pans", search_volume: 0, cost_per_click: 0 },
              ],
            },
          ],
        },
        {
          source: "prepositions",
          modifiers: [{ name: "for", suggestions: [{ keyword: "silicone utensils for cooking", search_volume: 90, cost_per_click: 0.4 }] }],
        },
        {
          source: "comparisons",
          modifiers: [{ name: "vs", suggestions: [{ keyword: "silicone utensils vs wooden", volume: 40, cpc: 0.3 }] }],
        },
      ],
    },
  });
  const byKeyword = Object.fromEntries(report.rows.map((row) => [row.keyword, row]));
  assert.equal(byKeyword["can silicone utensils go in the dishwasher"].bucket, "questions");
  assert.equal(byKeyword["can silicone utensils go in the dishwasher"].modifier, "can");
  assert.equal(byKeyword["can silicone utensils go in the dishwasher"].searchVolume, 720);
  assert.equal(byKeyword["can silicone utensils go in the dishwasher"].cpc, 1.2);
  assert.equal(byKeyword["can silicone utensils melt"].searchVolume, null);
  assert.equal(byKeyword["can silicone utensils melt"].cpc, null);
  assert.equal(byKeyword["can silicone utensils scratch pans"].searchVolume, 0);
  assert.equal(byKeyword["can silicone utensils scratch pans"].cpc, 0);
  assert.equal(byKeyword["silicone utensils for cooking"].bucket, "prepositions");
  assert.equal(byKeyword["silicone utensils vs wooden"].bucket, "comparisons");
  assert.equal(byKeyword["silicone utensils vs wooden"].searchVolume, 40);
});

test("nested provider buckets and flat rows are read without inventing volume", () => {
  const nested = normalizeReport({
    questions: { how: [{ keyword: "how to choose silicone utensils", volume: 15, cpc: 0.2 }] },
    gweb: {
      results: {
        data: [{ keyword: "wholesale silicone utensils", search_volume: 50, cost_per_click: 1.5, source_name: "related", intent: "transactional", sentiment: "positive" }],
      },
    },
  });
  assert.equal(nested.rows.find((row) => row.keyword.startsWith("how to"))?.bucket, "questions");
  assert.equal(nested.rows.find((row) => row.keyword.startsWith("how to"))?.modifier, "how");
  assert.equal(nested.rows.find((row) => row.keyword.startsWith("wholesale"))?.provider, "gweb");
  assert.equal(nested.rows.find((row) => row.keyword.startsWith("wholesale"))?.bucket, "related");

  const noise = normalizeReport({ views: 99, title: "nope", items: [{ name: "not a keyword", count: 12 }] });
  assert.equal(noise.rows.length, 0);
});

test("withheld counts use the leaves when both parent and children report them", () => {
  const both = normalizeReport({
    results: {
      withheld_results_count: 30,
      questions: { withheld_results_count: 10, how: [] },
      prepositions: { withheld_results_count: 20 },
    },
  });
  assert.equal(both.withheldCount, 30);
  const parentOnly = normalizeReport({ results: { withheld_results_count: 12, questions: { how: [] } } });
  assert.equal(parentOnly.withheldCount, 12);
});

test("failure messages stay in Chinese and keep the reset time", () => {
  const reset = "2026-09-01T00:00:00Z";
  const quota = explainAtpFailure({
    status: 429,
    retryAfterHeader: "3600",
    body: { error: { message: "Search limit reached", code: 429, details: { quota: 200, used: 200, remaining: 0, period: "cycle", resets_at: reset } } },
  });
  assert.equal(quota.code, "search_quota");
  assert.match(quota.message, /搜索额度已用完/);
  assert.equal(quota.message.includes(formatReset(reset) ?? "missing"), true);
  assert.equal(quota.resetsAt, reset);

  const read = explainAtpFailure({
    status: 429,
    retryAfterHeader: null,
    body: { error: { message: "Daily read limit reached", code: 429, error_code: "read_quota_exceeded", details: { period: "day", resets_at: reset } } },
  });
  assert.equal(read.code, "read_quota_exceeded");
  assert.match(read.message, /今日读取额度已用完/);

  const rate = explainAtpFailure({ status: 429, retryAfterHeader: "30", body: { error: { message: "Too many requests", code: 429 } } });
  assert.equal(rate.code, "rate_limit");
  assert.match(rate.message, /30/);

  const disabled = explainAtpFailure({
    status: 403,
    retryAfterHeader: null,
    body: { error: { message: "API access is disabled", code: 403, error_code: "api_disabled", details: { billing_block: "trial" } } },
  });
  assert.match(disabled.message, /试用/);

  const unpaid = explainAtpFailure({ status: 403, retryAfterHeader: null, body: { error: { error_code: "unpaid_invoice", message: "invoice", code: 403 } } });
  assert.match(unpaid.message, /未付账单/);

  const lifetime = explainAtpFailure({ status: 403, retryAfterHeader: null, body: { error: { error_code: "lifetime_api_access", message: "lifetime", code: 403 } } });
  assert.match(lifetime.message, /终身版/);

  const trial = explainAtpFailure({ status: 403, retryAfterHeader: null, body: { error: { error_code: "trial_api_access", message: "trial", code: 403 } } });
  assert.match(trial.message, /试用/);

  const plan = explainAtpFailure({ status: 403, retryAfterHeader: null, body: { error: { error_code: "ineligible_plan", message: "plan", code: 403 } } });
  assert.match(plan.message, /付费订阅/);

  const locked = explainAtpFailure({ status: 403, retryAfterHeader: null, body: { error: { message: "Workspace is locked. Please contact support.", code: 403 } } });
  assert.equal(locked.code, "workspace_locked");

  const scope = explainAtpFailure({ status: 403, retryAfterHeader: null, body: { error: { message: "Token is missing required scope: searches:write", code: 403 } } });
  assert.match(scope.message, /searches:write/);

  const unauthorized = explainAtpFailure({ status: 401, retryAfterHeader: null, body: { error: { message: "bad token SECRETVALUE", code: 401 } } });
  assert.equal(unauthorized.message.includes("SECRETVALUE"), false);
  assert.match(unauthorized.message, /令牌无效/);

  const tooLong = explainAtpFailure({ status: 422, retryAfterHeader: null, body: { error: { message: "too long", code: 422, error_code: "keyword_too_long" } } });
  assert.match(tooLong.message, /太长/);
});

test("search input is validated before any request body is built", () => {
  assert.equal(validateSearchInput({ keyword: "  ", language: "en", region: "us", provider: "gweb" }).ok, false);
  const middleEast = validateSearchInput({ keyword: "gift", language: "en", region: "me", provider: "gweb" });
  assert.equal(middleEast.ok, false);
  const ok = validateSearchInput({ keyword: " silicone utensil ", language: "EN", region: "GB", provider: "all" });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.value.keyword, "silicone utensil");
  assert.equal(ok.value.language, "en");
  assert.equal(ok.value.region, "gb");
  assert.equal(ok.value.provider, null);
  assert.deepEqual(buildSearchBody(ok.value), { search: { keyword: "silicone utensil", language: "en", region: "gb" } });
  assert.equal(buildSearchBody({ ...ok.value, provider: "gweb" }).search.provider, "gweb");
});

test("a parent created more than a minute ago is treated as a reuse", () => {
  const now = Date.parse("2026-11-26T08:00:00Z");
  const reused = parseParentSearch({
    data: {
      parent_search_id: "11111111-1111-1111-1111-111111111111",
      keyword: "gift",
      language: "en",
      region: "us",
      status: "completed",
      created_at: "2026-11-26T06:00:00Z",
      searches: [{ id: "22222222-2222-2222-2222-222222222222", provider: "gweb", status: "completed" }],
    },
  }, now);
  assert.equal(reused?.reused, true);
  const fresh = parseParentSearch({
    data: {
      parent_search_id: "11111111-1111-1111-1111-111111111111",
      created_at: "2026-11-26T07:59:30Z",
      status: "loading",
      searches: [],
    },
  }, now);
  assert.equal(fresh?.reused, false);
});

test("the setup hint does not contain a token", () => {
  assert.equal(MISSING_TOKEN_MESSAGE.includes("Bearer"), false);
  assert.equal(readRateHint(new Headers({ "RateLimit-Remaining": "18", "RateLimit-Limit": "200" })).remaining, 18);
});
