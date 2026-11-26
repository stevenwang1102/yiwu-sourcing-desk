import { marketSignal } from "./scoring";
import type { IntentId, MarketId, Product } from "./types";

export const INTENTS: { id: IntentId; name: string; use: string; hint: string }[] = [
  {
    id: "survey",
    name: "品类调查",
    use: "了解盘子，不作为主攻询盘词",
    hint: "买家在看是什么、好不好卖。头词经常被平台和品牌占住。",
  },
  {
    id: "wholesale",
    name: "批发采购",
    use: "给进口商和卖家的直接开发词",
    hint: "wholesale、supplier、bulk、private label 更接近贸易公司的对话。",
  },
  {
    id: "spec",
    name: "参数规格",
    use: "报价单和样品确认",
    hint: "容量、材质、件数写清楚，比堆品类形容词更有用。",
  },
  {
    id: "scene",
    name: "场景礼品",
    use: "节日和渠道推新",
    hint: "礼品公司常从场景找货，而不是从工厂词找货。",
  },
  {
    id: "info",
    name: "信息内容",
    use: "给买家的说明，不是询盘主场",
    hint: "how to / review 流量大也不等于采购。内容可以做，预期要降。",
  },
  {
    id: "compliance",
    name: "合规检索",
    use: "提醒内部去核实",
    hint: "有人搜认证词，不能反推这款货已经获证。",
  },
];

export const INTENT_MAP = Object.fromEntries(INTENTS.map((item) => [item.id, item])) as Record<
  IntentId,
  (typeof INTENTS)[number]
>;

export interface KeywordRow {
  keyword: string;
  intent: IntentId;
  sampleSv: number | null;
  sampleKd: number | null;
  sampleCpc: number | null;
  sampleTrend: number | null;
  aio: boolean | null;
  share: number;
}

const SHARES: Record<IntentId, { share: number; kd: number; cpc: number; trend: number; aio: boolean }> = {
  survey: { share: 0.34, kd: 8, cpc: 0.9, trend: -1, aio: true },
  wholesale: { share: 0.12, kd: -4, cpc: 1.35, trend: 2, aio: false },
  spec: { share: 0.1, kd: -8, cpc: 1.05, trend: 1, aio: false },
  scene: { share: 0.14, kd: -2, cpc: 1.1, trend: 4, aio: false },
  info: { share: 0.18, kd: -10, cpc: 0.55, trend: 0, aio: true },
  compliance: { share: 0.05, kd: -6, cpc: 1.2, trend: 1, aio: false },
};

function scenePhrase(product: Product) {
  if (product.seasons.includes("christmas") || product.seasons.includes("q4-gift")) return "christmas gift";
  if (product.seasons.includes("summer")) return "summer";
  if (product.seasons.includes("valentine")) return "valentine gift";
  if (product.seasons.includes("new-year")) return "new year";
  if (product.category === "kids") return "kids gift";
  if (product.category === "wellness") return "wellness gift";
  return "gift";
}

export function keywordRows(product: Product, market: MarketId): KeywordRow[] {
  const signal = marketSignal(product, market);
  const name = product.nameEn.toLowerCase();
  const scene = scenePhrase(product);
  const templates: { intent: IntentId; keyword: string }[] = [
    { intent: "survey", keyword: name },
    { intent: "wholesale", keyword: `wholesale ${name}` },
    { intent: "wholesale", keyword: `${name} supplier` },
    { intent: "spec", keyword: `${name} specifications` },
    { intent: "scene", keyword: `${scene} ${name}` },
    { intent: "info", keyword: `how to choose ${name}` },
    { intent: "compliance", keyword: `${name} certification` },
    { intent: "wholesale", keyword: `private label ${name}` },
  ];
  return templates.map((row) => {
    const tune = SHARES[row.intent];
    if (signal.monthlySearches == null || signal.kd == null || signal.cpc == null || signal.trend == null) {
      return {
        keyword: row.keyword,
        intent: row.intent,
        sampleSv: null,
        sampleKd: null,
        sampleCpc: null,
        sampleTrend: null,
        aio: null,
        share: tune.share,
      };
    }
    return {
      keyword: row.keyword,
      intent: row.intent,
      sampleSv: Math.max(10, Math.round(signal.monthlySearches * tune.share)),
      sampleKd: Math.max(12, Math.min(90, signal.kd + tune.kd)),
      sampleCpc: Math.round(signal.cpc * tune.cpc * 100) / 100,
      sampleTrend: signal.trend + tune.trend,
      aio: tune.aio,
      share: tune.share,
    };
  });
}

export interface SampleSerpRow {
  position: number;
  type: string;
  title: string;
  note: string;
}

const SERP_BY_INTENT: Record<IntentId, SampleSerpRow[]> = {
  survey: [
    { position: 1, type: "平台卖场", title: "示例 · 大型电商平台品类页", note: "头词常见，不代表你的客户会在这里留询盘" },
    { position: 2, type: "品牌独立站", title: "示例 · 消费品牌官网", note: "参数完整，批发条款通常不公开" },
    { position: 3, type: "评测内容", title: "示例 · 年度推荐文", note: "分流点击，采购意图弱" },
    { position: 4, type: "平台卖场", title: "示例 · 第二平台商品列表", note: "价格透明，交期和认证参差" },
    { position: 5, type: "区域分销", title: "示例 · 本地批发商目录", note: "贸易商真正的相邻对手" },
    { position: 6, type: "品牌独立站", title: "示例 · 品牌购买页", note: "零售价，不是 FOB" },
    { position: 7, type: "内容与目录", title: "示例 · 百科或维基类页面", note: "信息意图" },
    { position: 8, type: "平台卖场", title: "示例 · 跨境平台店铺", note: "低价带，服务能力未知" },
    { position: 9, type: "评测内容", title: "示例 · 视频平台", note: "不能把播放量当成询盘" },
    { position: 10, type: "区域分销", title: "示例 · 进口商落地页", note: "可观察对方怎么写起订和认证" },
  ],
  wholesale: [
    { position: 1, type: "跨境平台", title: "示例 · 批发平台搜索页", note: "贸易商的主战场，拼的是响应和样品" },
    { position: 2, type: "区域批发", title: "示例 · 进口批发商目录", note: "前排已有同行，要用服务差异" },
    { position: 3, type: "跨境平台", title: "示例 · 另一批发平台", note: "价格带可见，工厂身份未必真实" },
    { position: 4, type: "独立站卖家", title: "示例 · 小进口商询盘页", note: "说明这个词有人用来找货" },
    { position: 5, type: "内容与目录", title: "示例 · 供应商名录", note: "名录不是产品页" },
    { position: 6, type: "品牌独立站", title: "示例 · 品牌经销申请", note: "不一定接受新的贸易商" },
    { position: 7, type: "区域批发", title: "示例 · 礼品或行业批发站", note: "看对方最小起订怎么写" },
    { position: 8, type: "跨境平台", title: "示例 · 平台广告位（示意）", note: "当次没看到广告，也不等于没有人投" },
    { position: 9, type: "独立站卖家", title: "示例 · Private label 说明页", note: "贴牌是采购词，不是认证证明" },
    { position: 10, type: "内容与目录", title: "示例 · 论坛求货帖", note: "需求线索，流量未知" },
  ],
  spec: [
    { position: 1, type: "品牌独立站", title: "示例 · 规格书 PDF 页", note: "参数结构值得学，数字不能抄" },
    { position: 2, type: "平台卖场", title: "示例 · 带参数的商品页", note: "参数经常不完整" },
    { position: 3, type: "内容与目录", title: "示例 · 参数对照文", note: "信息意图" },
    { position: 4, type: "区域分销", title: "示例 · 经销商规格页", note: "可看买家在意哪些字段" },
    { position: 5, type: "品牌独立站", title: "示例 · 说明书下载", note: "未知项：我们自己的规格是否齐" },
    { position: 6, type: "平台卖场", title: "示例 · 问答区", note: "差评点常是推荐时要主动讲的风险" },
    { position: 7, type: "评测内容", title: "示例 · 拆解视频", note: "不能当成检测报告" },
    { position: 8, type: "区域分销", title: "示例 · 库存型号表", note: "现货逻辑和义乌档口不同" },
    { position: 9, type: "跨境平台", title: "示例 · 工厂参数模板", note: "模板化严重，要换成自己的确认项" },
    { position: 10, type: "内容与目录", title: "示例 · 标准介绍", note: "标准条文需核实，页面不是证书" },
  ],
  scene: [
    { position: 1, type: "平台卖场", title: "示例 · 节日礼品列表", note: "上新快，同质化高" },
    { position: 2, type: "独立礼品站", title: "示例 · 礼品公司目录", note: "这是主动推新的目标客户类型" },
    { position: 3, type: "内容与社交", title: "示例 · 礼品灵感文", note: "热度不等于可稳定供货" },
    { position: 4, type: "平台卖场", title: "示例 · 零售礼盒", note: "零售价不能倒推 FOB" },
    { position: 5, type: "区域批发", title: "示例 · 节日批发册", note: "交期窗口比搜索量更关键" },
    { position: 6, type: "品牌独立站", title: "示例 · 限定礼盒", note: "品牌款不一定能贴牌" },
    { position: 7, type: "内容与社交", title: "示例 · 短视频带货", note: "示例，不是播放量实测" },
    { position: 8, type: "平台卖场", title: "示例 · 捆绑套装", note: "套装是贸易商可做的组合" },
    { position: 9, type: "区域分销", title: "示例 · 商超季节档", note: "入场资格未知" },
    { position: 10, type: "独立礼品站", title: "示例 · 企业礼品页", note: "可改成客制 LOGO 的问法" },
  ],
  info: [
    { position: 1, type: "评测内容", title: "示例 · 选购指南", note: "适合给客户做说明，不适合当广告主词" },
    { position: 2, type: "品牌独立站", title: "示例 · 品牌博客", note: "权威感强，转化路径是零售" },
    { position: 3, type: "内容与目录", title: "示例 · 问答站点", note: "信息意图" },
    { position: 4, type: "评测内容", title: "示例 · 视频教程", note: "点击会被内容吃掉" },
    { position: 5, type: "平台卖场", title: "示例 · 平台购买指南", note: "平台导购" },
    { position: 6, type: "内容与目录", title: "示例 · 百科", note: "几乎无询盘" },
    { position: 7, type: "品牌独立站", title: "示例 · FAQ", note: "可借鉴问题，不可照搬答案" },
    { position: 8, type: "评测内容", title: "示例 · 对比文", note: "对比维度要工厂确认" },
    { position: 9, type: "区域分销", title: "示例 · 门店建议文", note: "本地安装或售后，我们不一定有" },
    { position: 10, type: "内容与社交", title: "示例 · 社区讨论", note: "舆情线索" },
  ],
  compliance: [
    { position: 1, type: "内容与目录", title: "示例 · 法规简介", note: "简介不是法律意见" },
    { position: 2, type: "检测机构", title: "示例 · 实验室服务页", note: "说明市场在问，不说明本品已测" },
    { position: 3, type: "品牌独立站", title: "示例 · 合规声明页", note: "别人的声明不能借用" },
    { position: 4, type: "政府或标准体", title: "示例 · 官方说明入口", note: "以官方文本为准，本工具不摘录条文" },
    { position: 5, type: "平台卖场", title: "示例 · 平台合规帮助", note: "平台规则会变" },
    { position: 6, type: "区域分销", title: "示例 · 进口商证书下载", note: "证书对应的是对方型号" },
    { position: 7, type: "内容与目录", title: "示例 · 顾问博客", note: "需核实，不能当结论" },
    { position: 8, type: "检测机构", title: "示例 · 费用说明", note: "费用未知，不代估检测报价" },
    { position: 9, type: "品牌独立站", title: "示例 · 标识指南", note: "标识位置要跟批次走" },
    { position: 10, type: "内容与目录", title: "示例 · 问答", note: "回答质量不稳定" },
  ],
};

export function sampleSerp(intent: IntentId) {
  return SERP_BY_INTENT[intent];
}

export function serpVerdict(intent: IntentId) {
  switch (intent) {
    case "survey":
      return "品类头词前排以平台和品牌为主。贸易公司不宜把这个词当成获客主场，只用来判断有没有人在看这个品。";
    case "wholesale":
      return "批发和供应商词更接近本公司的工作方式：直接找进口商、卖家和礼品公司。前排已有平台和同行，拼的是样品、交期和是否把认证写成「待核实」。";
    case "spec":
      return "参数词适合放进报价单和单品页。示例前排说明买家会核对规格，数字必须来自工厂确认，不能沿用本页示例。";
    case "scene":
      return "场景词适合行情推新和礼品季节。窗口短，先确认交期还赶不赶得上，再决定要不要主动发。";
    case "info":
      return "信息词可以做一页说明，帮助客户做决定，但不要按询盘词来估产量。";
    default:
      return "认证词只说明市场在问这个问题。对外材料写「需核实」，在工厂或实验室确认前不承诺已获证。";
  }
}
