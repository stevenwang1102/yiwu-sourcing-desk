"use client";

import { GradeMark, LinkButton, MoneyRange, ProvBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { getProduct } from "@/lib/catalog";
import { marketName } from "@/lib/markets";
import { scoreProduct } from "@/lib/scoring";
import { useStore } from "@/lib/storage";

export function CompareScreen() {
  const { workspace, settings, toggleCompare, clearCompare, setReportProducts } = useStore();
  const products = workspace.compareIds.map((id) => getProduct(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">对比 {products.length} 个单品</h1>
          <p className="text-sm text-muted-foreground">{marketName(workspace.market)} · 最多 3 个。价带和搜索都还是示例，除非你在单品页贴过实测。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReportProducts(products.map((item) => item.id), null)}>放入报告</Button>
          <Button variant="ghost" onClick={clearCompare}>清空</Button>
        </div>
      </div>
      {!products.length ? (
        <p className="text-sm text-muted-foreground">还没有加入对比。回到大盘或单品，点「对比」。</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const scored = scoreProduct(product, workspace.market);
            return (
              <article key={product.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold">{product.nameZh}</h2>
                    <p className="text-sm text-muted-foreground">{product.nameEn}</p>
                  </div>
                  {scored ? <GradeMark grade={scored.grade} /> : <ProvBadge kind="unknown" />}
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <Row k="示例指数" v={scored ? String(scored.index) : "未知"} />
                  <Row k="示例月搜索" v={scored?.signal.monthlySearches?.toLocaleString("zh-CN") ?? "未知"} />
                  <Row k="示例难度" v={scored?.signal.kd != null ? String(scored.signal.kd) : "未知"} />
                  <Row k="示例价带" v={<MoneyRange pair={product.priceUsd} settings={settings} />} />
                  <Row k="示例起订" v={String(product.moq)} />
                  <Row k="交期" v={`${product.leadDays[0]}–${product.leadDays[1]} 天`} />
                  <Row k="贴牌" v={product.labelEase} />
                  <Row k="买家" v={product.buyers.join("、")} />
                </dl>
                <p className="mt-3 text-sm leading-6">{product.pitch}</p>
                <p className="mt-2 text-xs text-muted-foreground">需核实：{product.compliance.slice(0, 3).join("、")}</p>
                <div className="mt-3 flex gap-2">
                  <LinkButton href={`/products/${product.id}`} size="sm">单品</LinkButton>
                  <Button size="sm" variant="ghost" onClick={() => toggleCompare(product.id)}>移除</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed pb-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
