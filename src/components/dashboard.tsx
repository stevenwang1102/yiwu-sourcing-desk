"use client";

import { GradeMark, MoneyRange, ProvBadge, SectionTitle } from "@/components/bits";
import { OpportunityMatrix } from "@/components/matrix";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PRODUCTS } from "@/lib/catalog";
import { formatInt, gradeLabel, signedPct } from "@/lib/format";
import { CATEGORIES, CATEGORY_MAP, MARKET_MAP, MARKETS } from "@/lib/markets";
import { BUDGET_FORMULA, INQUIRY_FORMULA, SCORE_FORMULA } from "@/lib/sources";
import { difficultyBand, inquiryEstimate, median, scoreProduct, tradeFit, weightedIntent } from "@/lib/scoring";
import { useStore } from "@/lib/storage";
import { toast } from "sonner";
import Link from "next/link";
import { useMemo, useState } from "react";

type SortKey = "index" | "sv" | "kd" | "cpc" | "trend" | "moq";

export function Dashboard() {
  const { settings, workspace, toggleCompare, setReportProducts } = useStore();
  const [sort, setSort] = useState<SortKey>("index");
  const [desc, setDesc] = useState(true);
  const enabled = PRODUCTS.filter((product) => settings.categories.includes(product.category));
  const scoped = enabled.filter((product) => workspace.category === "all" || product.category === workspace.category);
  const ranked = useMemo(() => {
    const rows = scoped.map((product) => ({ product, scored: scoreProduct(product, workspace.market) }));
    const value = (row: (typeof rows)[number]) => {
      if (sort === "moq") return row.product.moq;
      if (!row.scored) return -1;
      if (sort === "index") return row.scored.index;
      if (sort === "sv") return row.scored.signal.monthlySearches ?? -1;
      if (sort === "kd") return row.scored.signal.kd ?? -1;
      if (sort === "cpc") return row.scored.signal.cpc ?? -1;
      return row.scored.signal.trend ?? -1;
    };
    return [...rows].sort((a, b) => (desc ? value(b) - value(a) : value(a) - value(b)));
  }, [scoped, workspace.market, sort, desc]);

  const withScore = ranked.filter((row) => row.scored);
  const indexes = withScore.map((row) => row.scored!.index);
  const searches = withScore.map((row) => row.scored!.signal.monthlySearches!).filter((item) => item != null);
  const intent = weightedIntent(scoped, workspace.market);
  const inquiry = searches.reduce((sum, item) => sum + (inquiryEstimate(item, settings) ?? 0), 0);
  const categoryMeta = workspace.category === "all" ? null : CATEGORY_MAP[workspace.category];

  function header(key: SortKey, label: string) {
    return (
      <button
        className="inline-flex items-center gap-1"
        onClick={() => {
          if (sort === key) setDesc((value) => !value);
          else {
            setSort(key);
            setDesc(true);
          }
        }}
      >
        {label}
        {sort === key ? (desc ? " ↓" : " ↑") : ""}
      </button>
    );
  }

  function addCompare(id: string) {
    if (!workspace.compareIds.includes(id) && workspace.compareIds.length >= 3) {
      toast.warning("对比最多放 3 个单品");
      return;
    }
    toggleCompare(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">选品大盘</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          {MARKET_MAP[workspace.market].name}市场 · {workspace.category === "all" ? "五个类目一起看" : categoryMeta?.name}。这里回答「这个市场里，哪些货值得拿去跟买家谈」，不是「要不要建一个独立站」。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi name="主推单品" value={String(withScore.length)} unit="个" tag="catalog" foot="目录里把该市场列为主推的数量，不是机会预测。" />
        <Kpi name="机会指数中位" value={indexes.length ? String(median(indexes)) : "—"} unit="" tag="sample" foot="内部示例口径。点开单品可看权重。" />
        <Kpi name="高意图占比" value={intent == null ? "—" : String(intent)} unit={intent == null ? "" : "%"} tag="sample" foot="按示例搜索量加权，不是按词条数。" />
        <Kpi name="假设询盘粗算" value={searches.length ? formatInt(inquiry) : "—"} unit={searches.length ? "条/月" : ""} tag="assumption" foot={`搜索量 × ${(settings.clickShare * 100).toFixed(0)}% × ${(settings.inquiryRate * 100).toFixed(0)}%。`} />
      </div>

      <Card className="p-4">
        <SectionTitle kicker="Matrix" title="机会矩阵" action={<ProvBadge kind="sample" />} />
        <p className="mb-3 text-sm text-muted-foreground">坐标只在当前筛选里比较。右下偏中通常更好谈：有人在搜，难度还不是最高。单击气泡看摘要。</p>
        <OpportunityMatrix products={scoped} market={workspace.market} onCompare={addCompare} compared={workspace.compareIds} />
      </Card>

      <Card className="p-4">
        <SectionTitle
          kicker="Ranking"
          title="单品排行"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportProducts(withScore.slice(0, 5).map((row) => row.product.id), null)}
            >
              前 5 放入报告
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-2 font-medium">{header("index", "指数")}</th>
                <th className="py-2 pr-2 font-medium">单品</th>
                <th className="py-2 pr-2 font-medium">{header("sv", "示例搜索")}</th>
                <th className="py-2 pr-2 font-medium">{header("kd", "示例难度")}</th>
                <th className="py-2 pr-2 font-medium">{header("cpc", "示例 CPC")}</th>
                <th className="py-2 pr-2 font-medium">{header("trend", "示例趋势")}</th>
                <th className="py-2 pr-2 font-medium">{header("moq", "示例起订")}</th>
                <th className="py-2 pr-2 font-medium">示例价带</th>
                <th className="py-2 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ product, scored }) => (
                <tr key={product.id} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    {scored ? (
                      <span className="inline-flex items-center gap-2">
                        <GradeMark grade={scored.grade} />
                        {scored.index}
                      </span>
                    ) : (
                      <ProvBadge kind="unknown" />
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <Link href={`/products/${product.id}`} className="font-medium hover:underline">{product.nameZh}</Link>
                    <div className="text-xs text-muted-foreground">{product.nameEn} · {CATEGORY_MAP[product.category].name}</div>
                  </td>
                  <td className="py-2 pr-2">{scored?.signal.monthlySearches?.toLocaleString("zh-CN") ?? "未知"}</td>
                  <td className="py-2 pr-2">{scored?.signal.kd != null ? `${scored.signal.kd} ${difficultyBand(scored.signal.kd)}` : "未知"}</td>
                  <td className="py-2 pr-2">{scored?.signal.cpc != null ? `$${scored.signal.cpc.toFixed(2)}` : "未知"}</td>
                  <td className="py-2 pr-2">{scored?.signal.trend != null ? signedPct(scored.signal.trend) : "未知"}</td>
                  <td className="py-2 pr-2">{product.moq}</td>
                  <td className="py-2 pr-2"><MoneyRange pair={product.priceUsd} settings={settings} /></td>
                  <td className="py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => addCompare(product.id)}>
                      {workspace.compareIds.includes(product.id) ? "已对比" : "对比"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ranked.length ? <p className="pt-4 text-sm text-muted-foreground">当前类目已在设置里关闭，或目录里没有对应单品。</p> : null}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{SCORE_FORMULA} {gradeLabel("A")} / {gradeLabel("B")} / {gradeLabel("C")}。</p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <SectionTitle kicker="Markets" title="市场对照" />
          <p className="mb-3 text-sm text-muted-foreground">{MARKET_MAP[workspace.market].note}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 font-medium">市场</th>
                  <th className="py-2 font-medium">主推数</th>
                  <th className="py-2 font-medium">示例搜索中位</th>
                  <th className="py-2 font-medium">示例难度中位</th>
                  <th className="py-2 font-medium">高意图</th>
                  <th className="py-2 font-medium">语言</th>
                </tr>
              </thead>
              <tbody>
                {MARKETS.filter((item) => settings.markets.includes(item.id)).map((market) => {
                  const rows = scoped.map((product) => scoreProduct(product, market.id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
                  return (
                    <tr key={market.id} className={market.id === workspace.market ? "bg-muted/60" : "border-b"}>
                      <td className="py-2">{market.name}</td>
                      <td className="py-2">{rows.length}</td>
                      <td className="py-2">{median(rows.map((item) => item.signal.monthlySearches!))?.toLocaleString("zh-CN") ?? "—"}</td>
                      <td className="py-2">{median(rows.map((item) => item.signal.kd!)) ?? "—"}</td>
                      <td className="py-2">{weightedIntent(scoped, market.id) ?? "—"}%</td>
                      <td className="py-2">{market.lang}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">进口额整列留空：没有海关摘录，不填示例美元。跨市场倍率只用于相对比较。</p>
        </Card>
        <Card className="p-4">
          <SectionTitle kicker="Competition" title="竞争结构" action={<ProvBadge kind="sample" />} />
          {categoryMeta ? <Compete share={categoryMeta.compete} note={categoryMeta.competeNote} /> : (
            <div className="space-y-3">
              {CATEGORIES.filter((item) => settings.categories.includes(item.id)).map((item) => (
                <div key={item.id}>
                  <p className="mb-1 text-sm font-medium">{item.name}</p>
                  <Compete share={item.compete} note={item.competeNote} compact />
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            域名和流量不在这里编造。要看前十是谁，去单品分析粘贴当次搜索结果，或先看按意图分组的示例结构。
            验证预算若要用：{BUDGET_FORMULA} 当前门槛约等于点击 {settings.testClicks} 次。询盘公式：{INQUIRY_FORMULA}
          </p>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">贸易适配中位数（当前列表）{withScore.length ? Math.round(median(withScore.map((row) => tradeFit(row.product))) ?? 0) : "—"}，只反映起订和贴牌难度，不是毛利。</p>
    </div>
  );
}

function Kpi({ name, value, unit, tag, foot }: { name: string; value: string; unit: string; tag: "sample" | "assumption" | "catalog"; foot: string }) {
  return (
    <Card className="gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{name}</p>
        <ProvBadge kind={tag} />
      </div>
      <p className="text-3xl font-semibold tracking-tight">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">{foot}</p>
    </Card>
  );
}

function Compete({ share, note, compact }: { share: { label: string; value: number }[]; note: string; compact?: boolean }) {
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {share.map((item) => (
          <div key={item.label} style={{ width: `${item.value}%` }} className="h-full bg-primary/80 odd:bg-primary/45" title={`${item.label} ${item.value}%`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {share.map((item) => (
          <span key={item.label}>{item.label} {item.value}%</span>
        ))}
      </div>
      {compact ? null : <p className="mt-2 text-sm leading-6 text-muted-foreground">{note}</p>}
    </div>
  );
}
