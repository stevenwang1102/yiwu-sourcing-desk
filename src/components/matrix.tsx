"use client";

import { GradeMark, LinkButton, ProvBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { CATEGORY_MAP } from "@/lib/markets";
import { demandScore, scoreProduct } from "@/lib/scoring";
import type { MarketId, Product } from "@/lib/types";
import { useMemo, useState } from "react";

const COLOR: Record<string, string> = {
  "3c": "#1f6f6a",
  wellness: "#3f6b45",
  home: "#a15c32",
  kids: "#2c5f8a",
  funny: "#8a4d68",
};

export function OpportunityMatrix({
  products,
  market,
  onCompare,
  compared,
}: {
  products: Product[];
  market: MarketId;
  onCompare: (id: string) => void;
  compared: string[];
}) {
  const [active, setActive] = useState<string | null>(products[0]?.id ?? null);
  const points = useMemo(
    () =>
      products
        .map((product) => {
          const scored = scoreProduct(product, market);
          if (!scored || scored.signal.monthlySearches == null || scored.signal.kd == null) return null;
          return {
            product,
            scored,
            x: demandScore(scored.signal.monthlySearches),
            y: scored.signal.kd,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [products, market],
  );
  const current = points.find((item) => item.product.id === active) ?? points[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_280px]">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>横轴：示例需求（向右更高）</span>
          <span>纵轴：示例难度（向上更难）</span>
          <span>气泡：贸易适配</span>
          <ProvBadge kind="sample" />
        </div>
        <svg viewBox="0 0 640 420" className="h-auto w-full rounded-xl border bg-card">
          <rect x="48" y="16" width="560" height="360" className="fill-muted/40" />
          <text x="328" y="404" textAnchor="middle" className="fill-muted-foreground" fontSize="12">
            示例需求 →
          </text>
          <text x="18" y="196" transform="rotate(-90 18 196)" textAnchor="middle" className="fill-muted-foreground" fontSize="12">
            示例难度 →
          </text>
          {[0, 1, 2, 3, 4].map((step) => (
            <line key={step} x1={48 + step * 140} y1="16" x2={48 + step * 140} y2="376" className="stroke-border" />
          ))}
          <text x="470" y="350" fontSize="12" className="fill-primary">
            优先看这里：需求不差，难度不是最高
          </text>
          {points.map((point) => {
            const cx = Math.round(48 + (point.x / 100) * 560);
            const cy = Math.round(16 + ((100 - point.y) / 100) * 360);
            const r = Math.round(7 + point.scored.trade / 18);
            const on = point.product.id === current?.product.id;
            return (
              <g key={point.product.id} onClick={() => setActive(point.product.id)} className="cursor-pointer">
                <circle cx={cx} cy={cy} r={r} fill={COLOR[point.product.category]} opacity={on ? 1 : 0.78} stroke={on ? "var(--foreground)" : "transparent"} strokeWidth="2" />
                <title>{`${point.product.nameZh} 需求${Math.round(point.x)} 难度${Math.round(point.y)}`}</title>
              </g>
            );
          })}
        </svg>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {Object.entries(COLOR).map(([id, color]) => (
            <span key={id} className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-full" style={{ background: color }} />
              {CATEGORY_MAP[id as keyof typeof CATEGORY_MAP].name}
            </span>
          ))}
        </div>
      </div>
      {current ? (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <GradeMark grade={current.scored.grade} />
            <div>
              <p className="font-medium">{current.product.nameZh}</p>
              <p className="text-xs text-muted-foreground">{current.product.nameEn}</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6">{current.product.pitch}</p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">示例指数</dt><dd>{current.scored.index}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">示例难度</dt><dd>{current.scored.signal.kd}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted-foreground">示例月搜索</dt><dd>{current.scored.signal.monthlySearches?.toLocaleString("zh-CN")}</dd></div>
          </dl>
          <div className="mt-4 flex flex-col gap-2">
            <LinkButton href={`/products/${current.product.id}`}>打开单品</LinkButton>
            <Button variant="outline" onClick={() => onCompare(current.product.id)}>
              {compared.includes(current.product.id) ? "移出对比" : "加入对比"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">这个市场和类目下没有可画进矩阵的主推单品。</div>
      )}
    </div>
  );
}
