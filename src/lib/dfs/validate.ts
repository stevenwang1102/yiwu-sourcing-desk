import {
  DFS_LANGUAGES,
  DFS_MODES,
  VOLUME_KEYWORD_CAP,
  languageLabel,
  marketById,
  modeById,
  type DfsLanguageCode,
  type DfsMode,
} from "./constants";

const LANGUAGE_IDS = new Set<string>(DFS_LANGUAGES.map((item) => item.id));
const MODE_IDS = new Set<string>(DFS_MODES.map((item) => item.id));
const KEYWORD_PATTERN = /^[\p{L}\p{M}\p{N}\s'.&/\-]+$/u;

export interface ParsedLookup {
  mode: DfsMode;
  marketId: string;
  locationCode: number;
  locationLabel: string;
  languageCode: DfsLanguageCode;
  languageLabel: string;
  keywords: string[];
  refresh: boolean;
  cacheKey: string;
}

export function hasCredentials(login: string | undefined, password: string | undefined) {
  const user = typeof login === "string" ? login.trim() : "";
  const pass = typeof password === "string" ? password.trim() : "";
  if (!user || !pass) return null;
  return { login: user, password: pass };
}

export function splitKeywordText(text: string) {
  return text
    .split(/[\n,，;；]+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function lookupKey(mode: DfsMode, locationCode: number, languageCode: string, keywords: string[]) {
  const words = keywords.map((item) => item.toLowerCase()).sort((a, b) => a.localeCompare(b, "en"));
  return [mode, String(locationCode), languageCode, words.join("\n")].join("|");
}

function keywordError(keyword: string, mode: DfsMode) {
  const max = mode === "trends" ? 100 : 80;
  if (keyword.length < 2) return `「${keyword}」太短。关键词至少 2 个字符。这次没有向 DataForSEO 发请求。`;
  if (keyword.length > max) return `「${keyword.slice(0, 24)}…」超过 ${max} 个字符。请缩短后再查。这次没有向 DataForSEO 发请求。`;
  const words = keyword.split(" ").filter(Boolean);
  if (words.length > 10) return `「${keyword}」超过 10 个词。请改短后再查。这次没有向 DataForSEO 发请求。`;
  if (!KEYWORD_PATTERN.test(keyword)) {
    return `「${keyword}」里有 DataForSEO 不便接受的符号。请只保留文字、数字、空格、连字符和撇号。这次没有向 DataForSEO 发请求。`;
  }
  return null;
}

export function parseLookupInput(raw: unknown): { ok: true; value: ParsedLookup } | { ok: false; message: string } {
  const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const modeRaw = typeof body.mode === "string" ? body.mode.trim() : "";
  if (!MODE_IDS.has(modeRaw)) {
    return { ok: false, message: "请选择一种查询：搜索量、关键词建议、相关关键词或趋势热度。一次只会跑你选中的那一种。这次没有向 DataForSEO 发请求。" };
  }
  const mode = modeRaw as DfsMode;
  const spec = modeById(mode);
  if (!spec) return { ok: false, message: "不认识这种查询。这次没有向 DataForSEO 发请求。" };

  const marketId = typeof body.marketId === "string" ? body.marketId.trim() : "";
  const market = marketById(marketId);
  if (!market) {
    return { ok: false, message: "市场不在选品台已映射的范围内。中东要选阿联酋或沙特，没有单独的「中东」地区。这次没有向 DataForSEO 发请求。" };
  }

  const languageCode = typeof body.languageCode === "string" ? body.languageCode.trim().toLowerCase() : "";
  if (!LANGUAGE_IDS.has(languageCode)) {
    return { ok: false, message: "语言不在选品台已映射的范围内。当前可选英语、德语、日语、阿拉伯语。这次没有向 DataForSEO 发请求。" };
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (text.length > 4000) return { ok: false, message: "关键词太长。请分成几次查。这次没有向 DataForSEO 发请求。" };
  const pieces = splitKeywordText(text);
  if (!pieces.length) return { ok: false, message: "请先填写关键词。这次没有向 DataForSEO 发请求。" };

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const piece of pieces) {
    const error = keywordError(piece, mode);
    if (error) return { ok: false, message: error };
    const key = piece.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(piece);
  }

  if (mode === "volume" && keywords.length > VOLUME_KEYWORD_CAP) {
    return { ok: false, message: `搜索量一次最多 ${VOLUME_KEYWORD_CAP} 个词。请删到 ${VOLUME_KEYWORD_CAP} 个以内再查。这次没有向 DataForSEO 发请求。` };
  }
  if (mode !== "volume" && keywords.length !== 1) {
    return { ok: false, message: "这一档一次只查一个词。请只留一个种子词。这次没有向 DataForSEO 发请求。" };
  }

  return {
    ok: true,
    value: {
      mode,
      marketId: market.id,
      locationCode: market.locationCode,
      locationLabel: market.locationLabel,
      languageCode: languageCode as DfsLanguageCode,
      languageLabel: languageLabel(languageCode),
      keywords,
      refresh: body.refresh === true,
      cacheKey: lookupKey(mode, market.locationCode, languageCode, keywords),
    },
  };
}
