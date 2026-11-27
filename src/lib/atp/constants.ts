import { MARKETS } from "@/lib/markets";
import type { MarketId } from "@/lib/types";

export const ATP_SESSION_KEY = "yixuan.atp.session";

export const ATP_PROVIDERS = [
  { id: "gweb", label: "谷歌网页" },
  { id: "youtube", label: "YouTube" },
  { id: "bing", label: "必应" },
  { id: "amazon", label: "亚马逊" },
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "gemini", label: "Gemini" },
] as const;

export type AtpProviderId = (typeof ATP_PROVIDERS)[number]["id"];

export const ATP_LANGUAGES = [
  { id: "en", label: "英语" },
  { id: "de", label: "德语" },
  { id: "es", label: "西班牙语" },
  { id: "it", label: "意大利语" },
  { id: "fr", label: "法语" },
  { id: "pt", label: "葡萄牙语" },
  { id: "nl", label: "荷兰语" },
  { id: "pl", label: "波兰语" },
  { id: "ja", label: "日语" },
  { id: "ar", label: "阿拉伯语" },
] as const;

export type AtpLanguageId = (typeof ATP_LANGUAGES)[number]["id"];

export const ATP_REGIONS = [
  { id: "us", label: "美国 · us" },
  { id: "gb", label: "英国 · gb" },
  { id: "de", label: "德国 · de" },
  { id: "au", label: "澳大利亚 · au" },
  { id: "ae", label: "阿联酋 · ae" },
  { id: "sa", label: "沙特 · sa" },
  { id: "jp", label: "日本 · jp" },
  { id: "es", label: "西班牙 · es" },
  { id: "mx", label: "墨西哥 · mx" },
  { id: "it", label: "意大利 · it" },
  { id: "fr", label: "法国 · fr" },
  { id: "pt", label: "葡萄牙 · pt" },
  { id: "br", label: "巴西 · br" },
  { id: "nl", label: "荷兰 · nl" },
  { id: "pl", label: "波兰 · pl" },
] as const;

export type AtpRegionId = (typeof ATP_REGIONS)[number]["id"];

export const ATP_MARKETS = [
  { id: "US", label: "美国", language: "en", region: "us", desk: "US" },
  { id: "UK", label: "英国", language: "en", region: "gb", desk: "UK" },
  { id: "DE", label: "德国", language: "de", region: "de", desk: "DE" },
  { id: "AU", label: "澳大利亚", language: "en", region: "au", desk: "AU" },
  { id: "AE", label: "中东 · 阿联酋", language: "en", region: "ae", desk: "ME" },
  { id: "SA", label: "中东 · 沙特", language: "ar", region: "sa", desk: "ME" },
  { id: "JP", label: "日本", language: "ja", region: "jp", desk: "JP" },
  { id: "ES", label: "西班牙", language: "es", region: "es", desk: "ES" },
  { id: "MX", label: "墨西哥", language: "es", region: "mx", desk: "MX" },
  { id: "IT", label: "意大利", language: "it", region: "it", desk: "IT" },
  { id: "FR", label: "法国", language: "fr", region: "fr", desk: "FR" },
  { id: "PT", label: "葡萄牙", language: "pt", region: "pt", desk: "PT" },
  { id: "BR", label: "巴西", language: "pt", region: "br", desk: "BR" },
  { id: "NL", label: "荷兰", language: "nl", region: "nl", desk: "NL" },
  { id: "PL", label: "波兰", language: "pl", region: "pl", desk: "PL" },
] as const;

export type AtpMarketId = (typeof ATP_MARKETS)[number]["id"];

export const ATP_BUCKETS = [
  "questions",
  "prepositions",
  "comparisons",
  "alphabeticals",
  "numbers",
  "related",
  "other",
] as const;

export type AtpBucket = (typeof ATP_BUCKETS)[number];

const BUCKET_LABELS: Record<AtpBucket, string> = {
  questions: "疑问句",
  prepositions: "介词",
  comparisons: "比较",
  alphabeticals: "字母",
  numbers: "数字",
  related: "相关",
  other: "其他",
};

export function bucketLabel(bucket: string) {
  if (bucket in BUCKET_LABELS) return BUCKET_LABELS[bucket as AtpBucket];
  return bucket;
}

export function providerLabel(id: string | null | undefined) {
  if (!id || id === "all") return "全部平台";
  const found = ATP_PROVIDERS.find((item) => item.id === id);
  if (found) return found.label;
  if (id === "google") return "谷歌网页";
  return id;
}

export function languageLabel(id: string) {
  return ATP_LANGUAGES.find((item) => item.id === id)?.label ?? id;
}

export function regionLabel(id: string) {
  return ATP_REGIONS.find((item) => item.id === id)?.label ?? id;
}

export function presetForDesk(market: string) {
  if (market === "KR") return null;
  if (market === "ME") return ATP_MARKETS.find((item) => item.id === "AE") ?? null;
  return ATP_MARKETS.find((item) => item.id === market || item.desk === market) ?? null;
}

export function isDeskMarket(value: string): value is MarketId {
  return MARKETS.some((item) => item.id === value);
}

export function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "排队中";
    case "loading":
      return "收集中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return status || "未知";
  }
}

export function outcomeLabel(outcome: string | null) {
  switch (outcome) {
    case "results":
      return "有结果";
    case "empty":
      return "平台没有给出建议";
    case "partial_failure":
      return "部分请求失败";
    case "failed":
      return "平台没有返回建议";
    default:
      return outcome ? outcome : "尚未结算";
  }
}
