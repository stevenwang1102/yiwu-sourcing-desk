import { PRODUCTS } from "./catalog";
import { normalizeKeyword } from "./parse-metrics";

export function matchProductId(keyword: string) {
  const text = normalizeKeyword(keyword);
  let best: { id: string; len: number } | null = null;
  for (const product of PRODUCTS) {
    for (const term of [product.nameEn, ...product.aliases]) {
      const needle = term.toLowerCase();
      if (needle.length >= 4 && text.includes(needle) && (!best || needle.length > best.len)) {
        best = { id: product.id, len: needle.length };
      }
    }
  }
  return best?.id ?? null;
}
