import assert from "node:assert/strict";
import test from "node:test";
import { ATP_MARKETS, presetForDesk as atpPreset } from "./atp/constants";
import { DFS_MARKETS, presetForDesk as dfsPreset } from "./dfs/constants";
import { MARKETS, mergeSavedMarkets } from "./markets";

test("an untouched saved market list gains the smaller-language countries once", () => {
  const next = mergeSavedMarkets(["US", "UK", "DE", "AU", "ME", "JP"]);
  assert.deepEqual(next, MARKETS.map((item) => item.id));
});

test("a custom market list is kept, and unknown ids are dropped", () => {
  assert.deepEqual(mergeSavedMarkets(["US", "JP", "XX"]), ["US", "JP"]);
});

test("Spain and Mexico stay separate, and Korea is not an AnswerThePublic preset", () => {
  assert.equal(atpPreset("ES")?.region, "es");
  assert.equal(atpPreset("ES")?.language, "es");
  assert.equal(atpPreset("MX")?.region, "mx");
  assert.equal(atpPreset("MX")?.language, "es");
  assert.equal(atpPreset("IT")?.language, "it");
  assert.equal(atpPreset("KR"), null);
  assert.equal(atpPreset("ME")?.id, "AE");
  assert.equal(ATP_MARKETS.some((item) => (item.language as string) === "ko" || (item.region as string) === "kr"), false);
  assert.equal(dfsPreset("KR").languageCode, "ko");
  assert.equal(dfsPreset("KR").locationCode, 2410);
  for (const market of ATP_MARKETS) {
    if (market.id === "AE" || market.id === "SA") continue;
    const dfs = DFS_MARKETS.find((item) => item.id === market.id);
    assert.equal(dfs?.languageCode, market.language);
  }
});
