import assert from "node:assert/strict";
import test from "node:test";
import { formatMetric, inferOrigin, keywordStatus, normalizeMeasured } from "./keyword-origin";

test("origin is inferred from the provider that actually wrote the row", () => {
  assert.equal(inferOrigin("AnswerThePublic · Google"), "answerthepublic");
  assert.equal(inferOrigin("DataForSEO · 搜索量"), "dataforseo");
  assert.equal(inferOrigin("Keyword Planner"), "keyword-planner");
  assert.equal(inferOrigin("Google Trends"), "google-trends");
  assert.equal(inferOrigin("手动录入"), "manual");
  assert.equal(inferOrigin("某份自己的表"), "custom");
});

test("a returned 0 stays 0 and a missing metric stays null", () => {
  assert.equal(formatMetric(0), "0");
  assert.equal(formatMetric(null), "未知");
  assert.equal(formatMetric(undefined), "未知");
  const [row] = normalizeMeasured(
    [
      {
        id: "kw-1",
        keyword: "wholesale kids bath toy",
        monthlySearches: 0,
        competition: "",
        bidLow: null,
        bidHigh: null,
        trendIndex: null,
        cpc: 0,
        source: "DataForSEO · 搜索量",
        customerId: "missing-buyer",
      },
    ],
    new Set(["buyer-1"]),
  );
  assert.equal(row.monthlySearches, 0);
  assert.equal(row.cpc, 0);
  assert.equal(row.bidLow, null);
  assert.equal(row.competition, null);
  assert.equal(row.origin, "dataforseo");
  assert.equal(row.customerId, null);
  assert.equal(keywordStatus(row), "measured");
});

test("a hand-entered word without numbers is unknown, not measured", () => {
  const [row] = normalizeMeasured(
    [{ keyword: "funny gift for office", source: "手动录入", origin: "manual", monthlySearches: null }],
    new Set(),
  );
  assert.equal(row.origin, "manual");
  assert.equal(formatMetric(row.monthlySearches), "未知");
  assert.equal(keywordStatus(row), "unknown");
});
