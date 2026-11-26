import { PRODUCTS } from "./catalog";
import { categoryName, marketName } from "./markets";
import { scoreProduct } from "./scoring";
import type { CategoryId, MarketId, Product } from "./types";

export type TrendKind = "week" | "rising" | "seasonal" | "fresh";

export interface TrendCard {
  id: string;
  kind: TrendKind;
  product: Product;
  title: string;
  why: string;
  who: string;
  caution: string;
  pitch: string;
  index: number | null;
  grade: "A" | "B" | "C" | null;
  trend: number | null;
}

const ACTIVE = new Set(["q4-gift", "christmas", "new-year", "valentine", "always"]);

export function seasonOn(product: Product) {
  return product.seasons.some((season) => season !== "always" && ACTIVE.has(season));
}

function inScope(product: Product, market: MarketId, category: CategoryId | "all") {
  if (!product.markets.includes(market)) return false;
  if (category !== "all" && product.category !== category) return false;
  return true;
}

function cardPitch(product: Product, market: MarketId, reason: string) {
  return [
    `本周可以主动问的客户方向：${product.buyers.join("、")}。`,
    `市场：${marketName(market)}。货：${product.nameZh} / ${product.nameEn}。`,
    reason,
    "请不要写成「市场已经验证」。建议说法：我们在义乌看到类似货，想确认您这季要不要看样。",
    `认证与宣称仍是需核实：${product.compliance.slice(0, 3).join("、")}。`,
  ].join("\n");
}

export function trendBoard(market: MarketId, category: CategoryId | "all") {
  const scoped = PRODUCTS.filter((product) => inScope(product, market, category));
  const rising: TrendCard[] = [];
  const seasonal: TrendCard[] = [];
  const fresh: TrendCard[] = [];

  for (const product of scoped) {
    const scored = scoreProduct(product, market);
    const trend = scored?.signal.trend ?? null;
    if (trend != null && trend >= 8) {
      rising.push({
        id: `rising-${product.id}`,
        kind: "rising",
        product,
        title: `${product.nameZh}示例趋势向上`,
        why: `示例趋势 ${trend > 0 ? "+" : ""}${trend}%。这只说明我们在示例包里把它标成上行，要到 Google Trends 看相对热度后才能对客户说「在涨」。`,
        who: product.buyers.join("、"),
        caution: product.risks[0] ?? "先核对样品和认证。",
        pitch: cardPitch(product, market, `示例信号是趋势 ${trend > 0 ? "+" : ""}${trend}%，用来决定要不要这周发一版样品问题，不用来承诺销量。`),
        index: scored?.index ?? null,
        grade: scored?.grade ?? null,
        trend,
      });
    }
    if (seasonOn(product) && product.seasons.some((item) => item !== "always")) {
      seasonal.push({
        id: `season-${product.id}`,
        kind: "seasonal",
        product,
        title: product.seasonNote,
        why: `季节窗口来自目录判断（${product.seasons.filter((item) => item !== "always").join("、")}），不是搜索量实测。今天若已靠近窗口尾声，要先看交期 ${product.leadDays[0]}–${product.leadDays[1]} 天还赶不赶得上。`,
        who: product.buyers.join("、"),
        caution: "错过窗口就改推下一季，不要用示例趋势硬催客户。",
        pitch: cardPitch(product, market, product.seasonNote),
        index: scored?.index ?? null,
        grade: scored?.grade ?? null,
        trend,
      });
    }
    if (product.newness === "新品窗口") {
      fresh.push({
        id: `fresh-${product.id}`,
        kind: "fresh",
        product,
        title: "新品窗口，适合问要不要看样",
        why: `${categoryName(product.category)}里把这款标成新品窗口：竞争示例难度${scored ? ` ${scored.signal.kd}` : "未知"}，但不代表前十已经空出来。`,
        who: product.buyers.join("、"),
        caution: product.unknowns[0] ?? "规格和认证都还是未知。",
        pitch: cardPitch(product, market, "这是新品窗口的主动开发，不是成熟爆款补货。"),
        index: scored?.index ?? null,
        grade: scored?.grade ?? null,
        trend,
      });
    }
  }

  const weekPool = scoped
    .map((product) => {
      const scored = scoreProduct(product, market);
      if (!scored) return null;
      const bonus = (scored.signal.trend != null && scored.signal.trend >= 8 ? 8 : 0) + (seasonOn(product) ? 6 : 0) + (product.newness === "新品窗口" ? 5 : 0);
      return { product, scored, rank: scored.index + bonus };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 6);

  const week: TrendCard[] = weekPool.map(({ product, scored }) => ({
    id: `week-${product.id}`,
    kind: "week",
    product,
    title: "本周值得发一版",
    why: `综合示例机会指数 ${scored.index}（${scored.grade}）和季节或趋势标记。指数是内部示例口径，不是外部工具的官方分数。`,
    who: product.buyers.join("、"),
    caution: product.risks[0] ?? "先补未知项再发客户。",
    pitch: cardPitch(
      product,
      market,
      `内部示例指数 ${scored.index}，评级 ${scored.grade}。${product.pitch}`,
    ),
    index: scored.index,
    grade: scored.grade,
    trend: scored.signal.trend,
  }));

  const byTrend = (a: TrendCard, b: TrendCard) => (b.trend ?? -99) - (a.trend ?? -99);
  return {
    week,
    rising: rising.sort(byTrend),
    seasonal,
    fresh,
  };
}
