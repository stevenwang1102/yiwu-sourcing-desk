import { ATP_LANGUAGES, ATP_PROVIDERS, ATP_REGIONS, type AtpLanguageId, type AtpProviderId, type AtpRegionId } from "./constants";

const LANGUAGE_IDS = new Set<string>(ATP_LANGUAGES.map((item) => item.id));
const REGION_IDS = new Set<string>(ATP_REGIONS.map((item) => item.id));
const PROVIDER_IDS = new Set<string>(ATP_PROVIDERS.map((item) => item.id));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SearchInput {
  keyword: string;
  language: AtpLanguageId;
  region: AtpRegionId;
  provider: AtpProviderId | null;
}

export function validateSearchInput(raw: unknown): { ok: true; value: SearchInput } | { ok: false; message: string } {
  const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword) return { ok: false, message: "请先填写种子关键词。这次没有创建检索。" };
  if (keyword.length > 255) return { ok: false, message: "关键词超过 255 个字符。请缩短后再查。这次没有创建检索。" };

  const language = typeof body.language === "string" ? body.language.trim().toLowerCase() : "";
  if (!LANGUAGE_IDS.has(language)) {
    return { ok: false, message: "语言不在选品台已映射的范围内。当前可选英语、德语、日语、阿拉伯语。这次没有创建检索。" };
  }

  const region = typeof body.region === "string" ? body.region.trim().toLowerCase() : "";
  if (!REGION_IDS.has(region)) {
    return { ok: false, message: "地区不在选品台已映射的范围内。英国用 gb。中东要选阿联酋 ae 或沙特 sa，没有单独的「中东」代码。这次没有创建检索。" };
  }

  let provider: AtpProviderId | null = null;
  if (body.provider != null && body.provider !== "" && body.provider !== "all") {
    const value = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
    if (!PROVIDER_IDS.has(value)) return { ok: false, message: "不认识这个平台。这次没有创建检索。" };
    provider = value as AtpProviderId;
  }

  return {
    ok: true,
    value: {
      keyword,
      language: language as AtpLanguageId,
      region: region as AtpRegionId,
      provider,
    },
  };
}

export function buildSearchBody(input: SearchInput) {
  const search: { keyword: string; language: string; region: string; provider?: string } = {
    keyword: input.keyword,
    language: input.language,
    region: input.region,
  };
  if (input.provider) search.provider = input.provider;
  return { search };
}

export function validateIds(raw: unknown) {
  const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const clean = ids.filter((item): item is string => typeof item === "string" && UUID.test(item));
  if (!clean.length || clean.length !== ids.length || clean.length > 8) {
    return { ok: false as const, message: "检索编号不正确，没有继续向 AnswerThePublic 查询。" };
  }
  return { ok: true as const, ids: clean };
}

export function validateReportId(id: string) {
  return UUID.test(id);
}
