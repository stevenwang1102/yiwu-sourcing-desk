import { PRODUCTS } from "./catalog";
import { categoryName, marketName } from "./markets";
import { marketSignal, scoreProduct } from "./scoring";
import type { Inquiry, Product, StoredRecommendation } from "./types";

export interface Recommendation extends StoredRecommendation {
  product: Product;
}

function includesTerm(haystack: string, term: string) {
  const needle = term.trim().toLowerCase();
  if (needle.length < 2) return false;
  return haystack.toLowerCase().includes(needle);
}

export function matchTerms(product: Product, query: string) {
  const text = query.trim();
  if (!text) return [];
  const dict = [
    product.nameZh,
    product.nameEn,
    ...product.tags,
    ...product.aliases,
    ...product.specs,
    product.summary,
  ];
  const hits = new Set<string>();
  for (const term of dict) {
    if (term.length >= 2 && includesTerm(text, term)) hits.add(term);
  }
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2);
  const blob = `${product.nameZh} ${product.nameEn} ${product.tags.join(" ")} ${product.aliases.join(" ")} ${product.summary}`.toLowerCase();
  for (const token of tokens) {
    if (blob.includes(token)) hits.add(token);
  }
  return [...hits].slice(0, 6);
}

function pitchFor(
  product: Product,
  inquiry: Omit<Inquiry, "id" | "createdAt" | "sampleCase">,
  reasons: string[],
  unknowns: string[],
): { zh: string; en: string } {
  const market = marketName(inquiry.market);
  const [lo, hi] = product.priceUsd;
  const zh = [
    `${inquiry.customer || "您好"}，结合您在${market}的需求${inquiry.requirements ? `（${inquiry.requirements.slice(0, 80)}）` : ""}，建议先看「${product.nameZh} / ${product.nameEn}」。`,
    `可先沟通的贸易条件是示例，下单前以工厂确认为准：FOB 约 $${lo}–${hi}，起订约 ${product.moq}，交期约 ${product.leadDays[0]}–${product.leadDays[1]} 天，包装：${product.packing}。`,
    `推荐理由：${reasons.slice(0, 3).join("；")}。`,
    `先不要写进合同的未知项：${unknowns.slice(0, 3).join("；")}。认证一律需核实，我们不会把目录清单说成已获证。`,
    "如果方向对，我们可以按您的目标价去义乌对样，再回一版实价和可核对的证书清单。",
  ].join("\n");
  const en = `For ${inquiry.market}, we can look at ${product.nameEn} from Yiwu. Sample FOB band USD ${lo}–${hi}, sample MOQ ${product.moq}. Any certification is to be verified before we describe it as available.`;
  return { zh, en };
}

export function recommendFor(inquiry: Omit<Inquiry, "id" | "createdAt" | "sampleCase">): Recommendation[] {
  const rows: Recommendation[] = [];
  for (const product of PRODUCTS) {
    if (inquiry.category !== "all" && product.category !== inquiry.category) continue;
    let score = 0;
    const reasons: string[] = [];
    const risks = [...product.risks];
    const unknowns = [...product.unknowns];

    if (inquiry.category !== "all") {
      score += 18;
      reasons.push(`类目对齐：${categoryName(product.category)}`);
    } else {
      score += 6;
    }

    if (product.markets.includes(inquiry.market)) {
      score += 16;
      reasons.push(`${marketName(inquiry.market)}在这款的主推市场里`);
    } else {
      score += 3;
      risks.push(`${marketName(inquiry.market)}不在主推市场，语言、插头和认证都要单独开一列未知项`);
    }

    if (inquiry.priceMin != null || inquiry.priceMax != null) {
      const min = inquiry.priceMin ?? 0;
      const max = inquiry.priceMax ?? 99999;
      const [lo, hi] = product.priceUsd;
      if (hi >= min && lo <= max) {
        score += 16;
        reasons.push(`示例价带 $${lo}–${hi} 和客户价带有交集`);
      } else if (lo <= max * 1.3 && hi >= min * 0.7) {
        score += 8;
        reasons.push(`示例价带 $${lo}–${hi} 接近客户预算，但没有完全重合`);
      } else {
        score += 2;
        risks.push(`示例价带 $${lo}–${hi} 离客户预算较远`);
      }
    } else {
      score += 7;
      unknowns.push("客户没给价带，价格分没有打满");
    }

    if (inquiry.moq != null) {
      if (product.moq <= inquiry.moq) {
        score += 14;
        reasons.push(`示例起订 ${product.moq} 不超过客户可接受的 ${inquiry.moq}`);
      } else if (product.moq <= inquiry.moq * 1.5) {
        score += 8;
        reasons.push(`示例起订 ${product.moq} 略高于客户的 ${inquiry.moq}，可以谈拼单`);
      } else {
        score += 2;
        risks.push(`示例起订 ${product.moq} 高于客户 MOQ ${inquiry.moq}`);
      }
    } else {
      score += 6;
      unknowns.push("客户没给可接受的起订量");
    }

    if (inquiry.certs.length) {
      const hit = inquiry.certs.filter((cert) =>
        product.compliance.some((item) => item.toLowerCase().includes(cert.toLowerCase())),
      );
      if (hit.length) {
        score += 8;
        reasons.push(`客户提到的 ${hit.join("、")} 出现在「需核实」清单里，只说明要核对，不是已有证书`);
        risks.push("认证匹配不能写成「工厂已有证」");
      } else {
        score += 3;
        unknowns.push(`客户提到 ${inquiry.certs.join("、")}，目录清单里没有对应字样，需要直接问工厂`);
      }
    } else {
      score += 4;
    }

    if (inquiry.buyerType) {
      const buyerHit = product.buyers.some(
        (buyer) => buyer.includes(inquiry.buyerType) || inquiry.buyerType.includes(buyer),
      );
      if (buyerHit) {
        score += 10;
        reasons.push(`买家类型贴近：${inquiry.buyerType}`);
      } else {
        score += 4;
        unknowns.push(`目录里的常见买家是 ${product.buyers.join("、")}，和「${inquiry.buyerType}」没有直接重合`);
      }
    }

    const terms = matchTerms(product, `${inquiry.requirements}\n${inquiry.notes}`);
    score += Math.min(18, terms.length * 4);
    if (terms.length) reasons.push(`需求里提到：${terms.slice(0, 4).join("、")}`);
    else if (inquiry.requirements.trim()) unknowns.push("需求原文和这款的名称、标签没有直接重合，排序主要靠类目和贸易条件");

    const signal = marketSignal(product, inquiry.market);
    if (signal.trend != null && signal.trend >= 8) {
      score += 5;
      reasons.push(`示例趋势 ${signal.trend > 0 ? "+" : ""}${signal.trend}%，只作辅证，不是实测`);
    }

    const scored = scoreProduct(product, inquiry.market);
    if (scored?.grade === "C") {
      risks.push("按示例口径这款评级偏低，除非客户点名，否则不作为第一句推荐");
    }

    score = Math.max(1, Math.min(96, Math.round(score)));
    const pitch = pitchFor(product, inquiry, reasons, unknowns);
    rows.push({
      productId: product.id,
      product,
      score,
      reasons,
      risks: [...new Set(risks)].slice(0, 4),
      unknowns: [...new Set(unknowns)].slice(0, 4),
      pitchZh: pitch.zh,
      pitchEn: pitch.en,
    });
  }
  return rows.sort((a, b) => b.score - a.score || a.product.nameZh.localeCompare(b.product.nameZh, "zh-CN"));
}

export function toStored(rows: Recommendation[]): StoredRecommendation[] {
  return rows.map((row) => ({
    productId: row.productId,
    score: row.score,
    reasons: row.reasons,
    risks: row.risks,
    unknowns: row.unknowns,
    pitchZh: row.pitchZh,
    pitchEn: row.pitchEn,
  }));
}
