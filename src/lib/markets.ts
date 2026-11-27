import type { CategoryId, MarketId, Settings } from "./types";

export const MARKETS: {
  id: MarketId;
  name: string;
  nameEn: string;
  lang: string;
  note: string;
  sv: number;
  cpc: number;
  kd: number;
  intent: number;
  aio: number;
}[] = [
  {
    id: "US",
    name: "美国",
    nameEn: "United States",
    lang: "英语",
    note: "批发商、亚马逊卖家和礼品公司都常见。英语词可先建表，仍要用 Keyword Planner 按美国地域复核，不能把示例倍率当成实测。",
    sv: 1,
    cpc: 1,
    kd: 0,
    intent: 0,
    aio: 0,
  },
  {
    id: "UK",
    name: "英国",
    nameEn: "United Kingdom",
    lang: "英语",
    note: "英语可复用，但插头、UKCA、VAT 与玩具安全要单独核实。搜索量不能直接搬美国数字。",
    sv: 0.38,
    cpc: 0.9,
    kd: -3,
    intent: 1,
    aio: -4,
  },
  {
    id: "DE",
    name: "德国",
    nameEn: "Germany",
    lang: "德语",
    note: "德语词必须单独建表。这里的倍率只用于跨市场相对比较，不能当成德文搜索量。包装法与 WEEE 等需核实。",
    sv: 0.34,
    cpc: 0.86,
    kd: -1,
    intent: 2,
    aio: -6,
  },
  {
    id: "AU",
    name: "澳大利亚",
    nameEn: "Australia",
    lang: "英语",
    note: "体量通常小于美国。电器看 RCM、插头与标签，玩具看当地安全规则，全部需核实。",
    sv: 0.2,
    cpc: 0.82,
    kd: -6,
    intent: -1,
    aio: -8,
  },
  {
    id: "ME",
    name: "中东",
    nameEn: "Middle East",
    lang: "英语 / 阿拉伯语",
    note: "询盘常出现英语，但斋月档期、电压、G-Mark / SABER 一类要求需核实。示例倍率不是当地搜索量。",
    sv: 0.16,
    cpc: 0.7,
    kd: -8,
    intent: -2,
    aio: -10,
  },
  {
    id: "JP",
    name: "日本",
    nameEn: "Japan",
    lang: "日语",
    note: "日语词必须单独用 Keyword Planner 复核。英文品名的示例倍率不能代替日文搜索量。PSE、ST 等需核实。",
    sv: 0.28,
    cpc: 0.95,
    kd: 4,
    intent: 3,
    aio: -2,
  },
  {
    id: "ES",
    name: "西班牙",
    nameEn: "Spain",
    lang: "西班牙语",
    note: "目录没有把西班牙列为主推，大盘搜索量保持未知，不是 0。西班牙语要到数据工位按西班牙单独查。CE 与玩具、电器规则需核实。",
    sv: 0.22,
    cpc: 0.75,
    kd: -2,
    intent: 0,
    aio: -6,
  },
  {
    id: "MX",
    name: "墨西哥",
    nameEn: "Mexico",
    lang: "西班牙语",
    note: "墨西哥是单独的西语市场，不并进西班牙。目录没有主推，搜索量保持未知。NOM 与标签需核实。",
    sv: 0.18,
    cpc: 0.6,
    kd: -6,
    intent: -1,
    aio: -8,
  },
  {
    id: "IT",
    name: "意大利",
    nameEn: "Italy",
    lang: "意大利语",
    note: "目录没有把意大利列为主推，大盘搜索量保持未知。意大利语要单独查，不能搬德国或英语的示例倍率。",
    sv: 0.2,
    cpc: 0.72,
    kd: -2,
    intent: 0,
    aio: -6,
  },
  {
    id: "FR",
    name: "法国",
    nameEn: "France",
    lang: "法语",
    note: "目录没有把法国列为主推，大盘搜索量保持未知。法语词单独查。包装与电器规则需核实。",
    sv: 0.24,
    cpc: 0.78,
    kd: -1,
    intent: 1,
    aio: -6,
  },
  {
    id: "PT",
    name: "葡萄牙",
    nameEn: "Portugal",
    lang: "葡萄牙语",
    note: "葡萄牙和巴西分开，不合成一个葡语区。目录没有主推，搜索量保持未知。",
    sv: 0.08,
    cpc: 0.55,
    kd: -8,
    intent: -2,
    aio: -8,
  },
  {
    id: "BR",
    name: "巴西",
    nameEn: "Brazil",
    lang: "葡萄牙语",
    note: "巴西用葡萄牙语，地区是巴西，不是葡萄牙。目录没有主推，搜索量保持未知。INMETRO 一类要求需核实。",
    sv: 0.2,
    cpc: 0.5,
    kd: -4,
    intent: -1,
    aio: -8,
  },
  {
    id: "NL",
    name: "荷兰",
    nameEn: "Netherlands",
    lang: "荷兰语",
    note: "目录没有把荷兰列为主推，大盘搜索量保持未知。荷兰语要单独查。",
    sv: 0.1,
    cpc: 0.8,
    kd: -4,
    intent: 0,
    aio: -6,
  },
  {
    id: "PL",
    name: "波兰",
    nameEn: "Poland",
    lang: "波兰语",
    note: "目录没有把波兰列为主推，大盘搜索量保持未知。波兰语要单独查。",
    sv: 0.12,
    cpc: 0.45,
    kd: -6,
    intent: -1,
    aio: -8,
  },
  {
    id: "KR",
    name: "韩国",
    nameEn: "South Korea",
    lang: "韩语",
    note: "目录没有把韩国列为主推，大盘搜索量保持未知。韩语搜索量只走 DataForSEO。AnswerThePublic 没有韩语关键词检索，不会改用英语代替。KC、电器规则需核实。",
    sv: 0.16,
    cpc: 0.7,
    kd: 2,
    intent: 1,
    aio: -4,
  },
];

/** Markets shipped before the smaller-language list. An unchanged saved list picks up the new countries once. */
const LEGACY_MARKETS: MarketId[] = ["US", "UK", "DE", "AU", "ME", "JP"];

export function mergeSavedMarkets(saved: readonly string[] | undefined): MarketId[] {
  const known = new Set<string>(MARKETS.map((item) => item.id));
  if (!saved?.length) return DEFAULT_SETTINGS.markets.slice();
  const current = saved.filter((id): id is MarketId => known.has(id));
  const untouched = current.length === LEGACY_MARKETS.length && LEGACY_MARKETS.every((id) => current.includes(id));
  if (untouched) return DEFAULT_SETTINGS.markets.slice();
  return current.length ? current : DEFAULT_SETTINGS.markets.slice();
}

export const MARKET_MAP = Object.fromEntries(MARKETS.map((m) => [m.id, m])) as Record<
  MarketId,
  (typeof MARKETS)[number]
>;

export const CATEGORIES: {
  id: CategoryId;
  name: string;
  nameEn: string;
  blurb: string;
  compete: { label: string; value: number }[];
  competeNote: string;
}[] = [
  {
    id: "3c",
    name: "3C 数码",
    nameEn: "3C accessories",
    blurb: "充电器、音频、桌面配件。义乌以配件和组装款为主，品牌头词多被平台和品牌站占住，批发词才是贸易商的切口。",
    compete: [
      { label: "平台卖场", value: 46 },
      { label: "品牌独立站", value: 28 },
      { label: "区域分销", value: 16 },
      { label: "评测内容", value: 10 },
    ],
    competeNote: "示例结构：头词前排通常是平台和品牌。贸易商更适合用 wholesale / supplier 词做直接开发，而不是去抢品类大词。",
  },
  {
    id: "wellness",
    name: "大健康",
    nameEn: "Wellness",
    blurb: "运动恢复、个护小电器、日常保健周边。宣传语容易踩医疗宣称，对外先写用途，证书和宣称一律待核实。",
    compete: [
      { label: "品牌独立站", value: 34 },
      { label: "平台卖场", value: 32 },
      { label: "内容与评测", value: 20 },
      { label: "区域分销", value: 14 },
    ],
    competeNote: "示例结构：内容站会分流「怎么选」这类词。给买家的材料要避免疗效承诺。",
  },
  {
    id: "home",
    name: "家居",
    nameEn: "Home",
    blurb: "收纳、厨房、软装小件。适合拼柜和商超、家居渠道，客单不一定高，但复购和补货稳定。",
    compete: [
      { label: "平台卖场", value: 40 },
      { label: "区域分销", value: 24 },
      { label: "品牌独立站", value: 22 },
      { label: "内容与目录", value: 14 },
    ],
    competeNote: "示例结构：分销和平台并存。贸易商的差异在配色、包装和稳定交期，不在头词排名。",
  },
  {
    id: "kids",
    name: "儿童玩具",
    nameEn: "Kids toys",
    blurb: "益智、户外、安抚。认证和年龄标识是推荐前必须核对的未知项，不能把「常见项目」写成已经满足。",
    compete: [
      { label: "平台卖场", value: 38 },
      { label: "品牌独立站", value: 30 },
      { label: "区域分销", value: 18 },
      { label: "安全评测 / 内容", value: 14 },
    ],
    competeNote: "示例结构：品牌和平台占头词。贸易商适合做系列搭配和年龄段清晰的报价单。",
  },
  {
    id: "funny",
    name: "搞怪趣味",
    nameEn: "Novelty & gag",
    blurb: "礼品、派对、桌面小物。季节窗口短，适合主动推给礼品公司和节日渠道，不宜当成长线大词来养。",
    compete: [
      { label: "平台卖场", value: 44 },
      { label: "独立礼品站", value: 26 },
      { label: "区域批发", value: 18 },
      { label: "内容与社交", value: 12 },
    ],
    competeNote: "示例结构：社交热度和礼品目录比 SEO 头词更常被买家拿来问价。趋势数字仍是示例。",
  },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  (typeof CATEGORIES)[number]
>;

export const BUYER_TYPES = [
  "进口批发商",
  "亚马逊卖家",
  "独立站卖家",
  "礼品公司",
  "商超渠道",
  "区域分销商",
];

export const CERT_OPTIONS = [
  "CE",
  "FCC",
  "UKCA",
  "RoHS",
  "REACH",
  "PSE",
  "RCM",
  "CPSIA",
  "ASTM F963",
  "EN71",
  "FDA",
  "LFGB",
];

export const DEFAULT_SETTINGS: Settings = {
  companyName: "义乌选品台",
  defaultMarket: "US",
  markets: ["US", "UK", "DE", "AU", "ME", "JP", "ES", "MX", "IT", "FR", "PT", "BR", "NL", "PL", "KR"],
  categories: ["3c", "wellness", "home", "kids", "funny"],
  currency: "USD",
  fxUsdCny: 7.2,
  inquiryRate: 0.02,
  clickShare: 0.08,
  testClicks: 200,
};

export function marketName(id: MarketId) {
  return MARKET_MAP[id].name;
}

export function categoryName(id: CategoryId) {
  return CATEGORY_MAP[id].name;
}
