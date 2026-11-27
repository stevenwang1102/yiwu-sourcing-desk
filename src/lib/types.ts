export type CategoryId = "3c" | "wellness" | "home" | "kids" | "funny";

export type MarketId =
  | "US"
  | "UK"
  | "DE"
  | "AU"
  | "ME"
  | "JP"
  | "ES"
  | "MX"
  | "IT"
  | "FR"
  | "PT"
  | "BR"
  | "NL"
  | "PL"
  | "KR";

export type Provenance = "sample" | "measured" | "unknown" | "assumption";

/** 词库里一条词的实际来源。只包含本工作台真正会写入的途径。 */
export type KeywordOrigin =
  | "answerthepublic"
  | "dataforseo"
  | "keyword-planner"
  | "google-trends"
  | "manual"
  | "custom";

/** 海外买家。只存名字，不是客户管理系统。 */
export interface Customer {
  id: string;
  name: string;
  createdAt: string;
}

export type IntentId =
  | "survey"
  | "wholesale"
  | "spec"
  | "scene"
  | "info"
  | "compliance";

export type LabelEase = "容易" | "一般" | "难";

export type Newness = "常青" | "上升" | "季节" | "新品窗口";

export interface Product {
  id: string;
  category: CategoryId;
  nameZh: string;
  nameEn: string;
  summary: string;
  specs: string[];
  /** 示例起订，不是报价。 */
  moq: number;
  /** 示例 FOB 单价美元区间。 */
  priceUsd: [number, number];
  packing: string;
  leadDays: [number, number];
  buyers: string[];
  markets: MarketId[];
  tags: string[];
  aliases: string[];
  seasons: string[];
  seasonNote: string;
  /** 示意税号，口径可能宽于本品，需核实。 */
  hs: string;
  /** 常见需核对项，不是已获证，也不是确定的准入要求。 */
  compliance: string[];
  sourcing: string;
  pitch: string;
  risks: string[];
  unknowns: string[];
  /** 美国英语词的示例月搜索量，仅作相对比较。 */
  sv: number;
  kd: number;
  cpc: number;
  trend: number;
  intent: number;
  aio: number;
  labelEase: LabelEase;
  newness: Newness;
  /** 示例分区，不是真实档口号。 */
  zone: string;
}

export interface Settings {
  companyName: string;
  defaultMarket: MarketId;
  markets: MarketId[];
  categories: CategoryId[];
  currency: "USD" | "CNY";
  /** 1 美元兑人民币。假设汇率，不是牌价。 */
  fxUsdCny: number;
  /** 假设询盘率，默认 2%。 */
  inquiryRate: number;
  /** 假设自然点击份额，默认 8%。 */
  clickShare: number;
  /** 验证点击次数，用于粗算预算门槛。 */
  testClicks: number;
}

export interface Workspace {
  market: MarketId;
  category: CategoryId | "all";
  compareIds: string[];
  reportProductIds: string[];
  reportCaseId: string | null;
}

export interface Inquiry {
  id: string;
  title: string;
  customer: string;
  market: MarketId;
  category: CategoryId | "all";
  requirements: string;
  priceMin: number | null;
  priceMax: number | null;
  moq: number | null;
  certs: string[];
  buyerType: string;
  notes: string;
  createdAt: string;
  /** 预置示例询盘，不是客户真单。 */
  sampleCase: boolean;
}

export interface StoredRecommendation {
  productId: string;
  score: number;
  reasons: string[];
  risks: string[];
  unknowns: string[];
  pitchZh: string;
  pitchEn: string;
}

export interface SavedCase {
  id: string;
  createdAt: string;
  inquiry: Inquiry;
  results: StoredRecommendation[];
  selectedProductIds: string[];
  note: string;
}

export interface MeasuredKeyword {
  id: string;
  keyword: string;
  monthlySearches: number | null;
  competition: string | null;
  bidLow: number | null;
  bidHigh: number | null;
  bidCurrency: string | null;
  /** Google Trends 相对热度 0–100，不是搜索量。 */
  trendIndex: number | null;
  /** AnswerThePublic 的 cost_per_click。没有就不要填 0。不是页首出价。 */
  cpc?: number | null;
  /** questions / prepositions / comparisons 等来源桶。 */
  atpBucket?: string | null;
  /** 给人看的来源说明，例如「DataForSEO · 搜索量」。筛选以 origin 为准。 */
  source: string;
  /** 这条词从哪来。写入工具结果时自动带上，之后可以改。 */
  origin: KeywordOrigin;
  /** 归到哪位海外买家。空表示还没指定。 */
  customerId: string | null;
  pastedAt: string;
  productId: string | null;
  note: string;
}

export interface SerpRow {
  id: string;
  keyword: string;
  position: number;
  title: string;
  url: string;
  type: string;
  source: string;
  pastedAt: string;
  productId: string | null;
}

export interface CheckState {
  marked: boolean;
  note: string;
}

export interface AppState {
  version: 1;
  settings: Settings;
  workspace: Workspace;
  inquiries: Inquiry[];
  cases: SavedCase[];
  /** 词库里可选的海外买家。 */
  customers: Customer[];
  /** 之后写入词库时默认归到的客户。 */
  assignCustomerId: string | null;
  measured: MeasuredKeyword[];
  serp: SerpRow[];
  notes: Record<string, string>;
  checks: Record<string, Record<string, CheckState>>;
}
