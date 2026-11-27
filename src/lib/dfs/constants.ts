export const DFS_SESSION_KEY = "yixuan.dfs.session";

/**
 * Google Ads geotarget criterion IDs for countries (Target Type Country, Status Active).
 * DataForSEO Google Ads Keywords Data uses these IDs as location_code.
 * Checked against the Google Ads geotargets CSV dated 2026-10-06. Not search volumes.
 */
export const DFS_MARKETS = [
  { id: "US", label: "美国", languageCode: "en", languageLabel: "英语", locationCode: 2840, locationLabel: "美国", desk: "US" },
  { id: "UK", label: "英国", languageCode: "en", languageLabel: "英语", locationCode: 2826, locationLabel: "英国", desk: "UK" },
  { id: "DE", label: "德国", languageCode: "de", languageLabel: "德语", locationCode: 2276, locationLabel: "德国", desk: "DE" },
  { id: "AU", label: "澳大利亚", languageCode: "en", languageLabel: "英语", locationCode: 2036, locationLabel: "澳大利亚", desk: "AU" },
  { id: "AE", label: "中东 · 阿联酋", languageCode: "en", languageLabel: "英语", locationCode: 2784, locationLabel: "阿联酋", desk: "ME" },
  { id: "SA", label: "中东 · 沙特", languageCode: "ar", languageLabel: "阿拉伯语", locationCode: 2682, locationLabel: "沙特", desk: "ME" },
  { id: "JP", label: "日本", languageCode: "ja", languageLabel: "日语", locationCode: 2392, locationLabel: "日本", desk: "JP" },
  { id: "ES", label: "西班牙", languageCode: "es", languageLabel: "西班牙语", locationCode: 2724, locationLabel: "西班牙", desk: "ES" },
  { id: "MX", label: "墨西哥", languageCode: "es", languageLabel: "西班牙语", locationCode: 2484, locationLabel: "墨西哥", desk: "MX" },
  { id: "IT", label: "意大利", languageCode: "it", languageLabel: "意大利语", locationCode: 2380, locationLabel: "意大利", desk: "IT" },
  { id: "FR", label: "法国", languageCode: "fr", languageLabel: "法语", locationCode: 2250, locationLabel: "法国", desk: "FR" },
  { id: "PT", label: "葡萄牙", languageCode: "pt", languageLabel: "葡萄牙语", locationCode: 2620, locationLabel: "葡萄牙", desk: "PT" },
  { id: "BR", label: "巴西", languageCode: "pt", languageLabel: "葡萄牙语", locationCode: 2076, locationLabel: "巴西", desk: "BR" },
  { id: "NL", label: "荷兰", languageCode: "nl", languageLabel: "荷兰语", locationCode: 2528, locationLabel: "荷兰", desk: "NL" },
  { id: "PL", label: "波兰", languageCode: "pl", languageLabel: "波兰语", locationCode: 2616, locationLabel: "波兰", desk: "PL" },
  { id: "KR", label: "韩国", languageCode: "ko", languageLabel: "韩语", locationCode: 2410, locationLabel: "韩国", desk: "KR" },
] as const;

export type DfsMarketId = (typeof DFS_MARKETS)[number]["id"];

/** ISO 639-1 codes. DataForSEO documents language_code as ISO 639-1. */
export const DFS_LANGUAGES = [
  { id: "en", label: "英语" },
  { id: "de", label: "德语" },
  { id: "es", label: "西班牙语" },
  { id: "it", label: "意大利语" },
  { id: "fr", label: "法语" },
  { id: "pt", label: "葡萄牙语" },
  { id: "nl", label: "荷兰语" },
  { id: "pl", label: "波兰语" },
  { id: "ja", label: "日语" },
  { id: "ko", label: "韩语" },
  { id: "ar", label: "阿拉伯语" },
] as const;

export type DfsLanguageCode = (typeof DFS_LANGUAGES)[number]["id"];

export const DFS_MODES = [
  {
    id: "volume",
    label: "搜索量",
    channel: "Google Ads 搜索量",
    detail: "一次实时请求，只查你填的这些词：月均搜索量、CPC、竞争和页首出价。最多 20 个词，不含搜索合作伙伴网络，也不会顺带查建议词或趋势。",
  },
  {
    id: "ideas",
    label: "关键词建议",
    channel: "Google Ads 关键词建议",
    detail: "一次实时请求，只提交一个种子词。Google Ads 可能返回很多建议；这里按月搜索从高到低只保留 80 条。不会同时查趋势或相关词。",
  },
  {
    id: "related",
    label: "相关关键词",
    channel: "Labs 相关关键词",
    detail: "一次实时请求，取「相关搜索」的一层，最多 20 条。不打开 SERP 和点击流这类附加项。",
  },
  {
    id: "trends",
    label: "趋势热度",
    channel: "Google Trends",
    detail: "一次实时请求，网页搜索、过去 12 个月。得到的是 0–100 的相对热度，不是月搜索量。不会同时查搜索量。",
  },
] as const;

export type DfsMode = (typeof DFS_MODES)[number]["id"];

export const VOLUME_KEYWORD_CAP = 20;
export const IDEAS_ROW_CAP = 80;
export const RELATED_LIMIT = 20;
export const RELATED_DEPTH = 1;
export const TRENDS_TOP_CAP = 20;
export const TRENDS_RISING_CAP = 10;
export const SERVER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const BROWSER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const MODE_PRICE_PATHS: Record<DfsMode, string[]> = {
  volume: ["keywords_data", "google_ads", "search_volume", "live"],
  ideas: ["keywords_data", "google_ads", "keywords_for_keywords", "live"],
  related: ["dataforseo_labs", "google", "related_keywords", "live"],
  trends: ["keywords_data", "google_trends", "explore", "live"],
};

export function modeById(mode: string) {
  return DFS_MODES.find((item) => item.id === mode) ?? null;
}

export function pricePath(mode: DfsMode) {
  return MODE_PRICE_PATHS[mode];
}

export function endpointPath(mode: DfsMode) {
  switch (mode) {
    case "volume":
      return "/v3/keywords_data/google_ads/search_volume/live";
    case "ideas":
      return "/v3/keywords_data/google_ads/keywords_for_keywords/live";
    case "related":
      return "/v3/dataforseo_labs/google/related_keywords/live";
    case "trends":
      return "/v3/keywords_data/google_trends/explore/live";
  }
}

export function presetForDesk(market: string) {
  if (market === "ME") return DFS_MARKETS.find((item) => item.id === "AE") ?? DFS_MARKETS[0];
  return DFS_MARKETS.find((item) => item.id === market || item.desk === market) ?? DFS_MARKETS[0];
}

export function marketById(id: string) {
  return DFS_MARKETS.find((item) => item.id === id) ?? null;
}

export function languageLabel(code: string) {
  return DFS_LANGUAGES.find((item) => item.id === code)?.label ?? code;
}
