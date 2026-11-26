"use client";

import { GradeMark, LinkButton, MoneyRange, ProvBadge, SectionTitle } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCTS, getProduct } from "@/lib/catalog";
import { gradeLabel, signedPct } from "@/lib/format";
import { INTENT_MAP, INTENTS, keywordRows, sampleSerp, serpVerdict } from "@/lib/keywords";
import { CATEGORY_MAP, MARKET_MAP } from "@/lib/markets";
import { normalizeKeyword, parseKeywordPaste } from "@/lib/parse-metrics";
import { difficultyBand, inquiryEstimate, scoreProduct } from "@/lib/scoring";
import { BUDGET_FORMULA, INQUIRY_FORMULA, SCORE_FORMULA } from "@/lib/sources";
import { useStore } from "@/lib/storage";
import type { IntentId } from "@/lib/types";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export function ProductScreen() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const product = getProduct(id);
  const { settings, workspace, state, toggleCompare, setReportProducts, addMeasured, setNote, setCheck } = useStore();
  const [intent, setIntent] = useState<IntentId>("wholesale");
  const [paste, setPaste] = useState("");

  const scored = product ? scoreProduct(product, workspace.market) : null;
  const rows = product ? keywordRows(product, workspace.market) : [];
  const measuredMap = new Map<string, (typeof state.measured)[number]>();
  for (const row of state.measured) {
    const key = normalizeKeyword(row.keyword);
    if (!measuredMap.has(key)) measuredMap.set(key, row);
  }

  if (!product) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">没有这件单品</h1>
        <LinkButton href="/products" variant="outline">返回目录</LinkButton>
      </div>
    );
  }

  const signal = scored?.signal;
  const inquiries = inquiryEstimate(signal?.monthlySearches ?? null, settings);
  const serp = sampleSerp(intent);

  function ingest() {
    const parsed = parseKeywordPaste(paste, "Keyword Planner");
    if (!parsed.rows.length) {
      toast.error(parsed.warnings[0] ?? "没有解析出词");
      return;
    }
    addMeasured(parsed.rows.map((row) => ({
      keyword: row.keyword,
      monthlySearches: row.monthlySearches,
      competition: row.competition,
      bidLow: row.bidLow,
      bidHigh: row.bidHigh,
      bidCurrency: row.bidCurrency,
      trendIndex: row.trendIndex,
      source: "Keyword Planner",
      productId: product!.id,
      note: "从单品页粘贴",
    })));
    setPaste("");
    toast.success(`已记入 ${parsed.rows.length} 条实测。页首出价不是实际花费。`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{CATEGORY_MAP[product.category].name} · {MARKET_MAP[workspace.market].name}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{product.nameZh}</h1>
          <p className="text-sm text-muted-foreground">{product.nameEn}</p>
          <p className="mt-2 max-w-3xl text-sm leading-6">{product.summary}</p>
        </div>
        <div className="flex items-center gap-2">
          {scored ? <GradeMark grade={scored.grade} /> : <ProvBadge kind="unknown" />}
          <div>
            <p className="text-2xl font-semibold">{scored ? scored.index : "—"}</p>
            <p className="text-xs text-muted-foreground">{scored ? gradeLabel(scored.grade) : "非主推市场，无示例指数"}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => toggleCompare(product.id)}>{workspace.compareIds.includes(product.id) ? "移出对比" : "加入对比"}</Button>
        <Button size="sm" variant="outline" onClick={() => setReportProducts([product.id], null)}>放入报告</Button>
        <LinkButton href="/site" size="sm" variant="ghost">可选：独立站提纲</LinkButton>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="示例月搜索" value={signal?.monthlySearches?.toLocaleString("zh-CN") ?? "未知"} kind={signal?.monthlySearches == null ? "unknown" : "sample"} />
        <Metric label="示例难度" value={signal?.kd != null ? `${signal.kd} · ${difficultyBand(signal.kd)}` : "未知"} kind={signal?.kd == null ? "unknown" : "sample"} />
        <Metric label="示例 CPC" value={signal?.cpc != null ? `$${signal.cpc.toFixed(2)}` : "未知"} kind={signal?.cpc == null ? "unknown" : "sample"} />
        <Metric label="假设月询盘" value={inquiries == null ? "未知" : String(inquiries)} kind={inquiries == null ? "unknown" : "assumption"} />
      </div>

      <Card className="p-4">
        <SectionTitle kicker="Screening" title="贸易公司怎么看这款" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="text-sm leading-6">
            <p>{product.pitch}</p>
            <p className="mt-2">示例贸易条件：FOB <MoneyRange pair={product.priceUsd} settings={settings} />，起订 {product.moq}，交期 {product.leadDays[0]}–{product.leadDays[1]} 天。</p>
            <p>包装：{product.packing}。贴牌：{product.labelEase}。{product.zone}。</p>
            <p className="mt-2 text-muted-foreground">{product.sourcing}</p>
          </div>
          <div>
            {scored ? (
              <ul className="space-y-2 text-sm">
                <Bar label="需求" value={scored.demand} weight="30%" />
                <Bar label="难度反向" value={scored.ease} weight="22%" />
                <Bar label="高意图" value={scored.intent} weight="18%" />
                <Bar label="趋势" value={scored.trend} weight="12%" />
                <Bar label="贸易适配" value={scored.trade} weight="18%" />
              </ul>
            ) : <p className="text-sm text-muted-foreground">这个市场没有示例搜索量。把 Keyword Planner 按当地语言导出后贴到下面，才会出现实测。</p>}
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{SCORE_FORMULA}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {product.specs.map((spec) => <span key={spec} className="rounded-md bg-muted px-2 py-1">{spec}</span>)}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">HS {product.hs} 只是示意税号，口径可能宽于本品。<ProvBadge kind="verify" /></p>
      </Card>

      <Card className="p-4">
        <SectionTitle kicker="Keywords" title="意图分组" action={<ProvBadge kind="sample" />} />
        <div className="mb-3 flex flex-wrap gap-2">
          {INTENTS.map((item) => (
            <Button key={item.id} size="sm" variant={intent === item.id ? "default" : "outline"} onClick={() => setIntent(item.id)}>{item.name}</Button>
          ))}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{INTENT_MAP[intent].hint} {INTENT_MAP[intent].use}。</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 font-medium">关键词</th>
                <th className="py-2 font-medium">意图</th>
                <th className="py-2 font-medium">月搜索</th>
                <th className="py-2 font-medium">难度</th>
                <th className="py-2 font-medium">成本参照</th>
                <th className="py-2 font-medium">趋势</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const hit = measuredMap.get(normalizeKeyword(row.keyword));
                const sv = hit?.monthlySearches ?? row.sampleSv;
                const svKind = hit?.monthlySearches != null ? "measured" : row.sampleSv == null ? "unknown" : "sample";
                return (
                  <tr key={row.keyword} className="border-b last:border-0">
                    <td className="py-2 pr-2">
                      {row.keyword}
                      {hit ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{hit.source}</span> : null}
                    </td>
                    <td className="py-2 pr-2">{INTENT_MAP[row.intent].name}</td>
                    <td className="py-2 pr-2"><span className="mr-1">{sv ?? "—"}</span><ProvBadge kind={svKind} /></td>
                    <td className="py-2 pr-2">{row.sampleKd ?? "未知"} <ProvBadge kind={row.sampleKd == null ? "unknown" : "sample"} /></td>
                    <td className="py-2 pr-2">
                      {hit?.cpc != null ? (
                        <span>CPC ${hit.cpc} <ProvBadge kind="measured" /></span>
                      ) : hit && (hit.bidLow != null || hit.bidHigh != null) ? (
                        <span>出价 {hit.bidLow ?? "—"}–{hit.bidHigh ?? "—"} {hit.bidCurrency ?? ""} <ProvBadge kind="measured" /></span>
                      ) : hit ? (
                        <span>未知 <ProvBadge kind="unknown" /></span>
                      ) : (
                        <span>{row.sampleCpc != null ? `$${row.sampleCpc.toFixed(2)}` : "未知"} <ProvBadge kind={row.sampleCpc == null ? "unknown" : "sample"} /></span>
                      )}
                    </td>
                    <td className="py-2">
                      {hit?.trendIndex != null ? <span>热度 {hit.trendIndex} <ProvBadge kind="measured" /></span> : <span>{row.sampleTrend != null ? signedPct(row.sampleTrend) : "未知"} <ProvBadge kind={row.sampleTrend == null ? "unknown" : "sample"} /></span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{INQUIRY_FORMULA} {BUDGET_FORMULA}</p>
        {state.measured.some((row) => row.productId === product.id && !rows.some((item) => normalizeKeyword(item.keyword) === normalizeKeyword(row.keyword))) ? (
          <div className="mt-3">
            <p className="mb-1 text-sm font-medium">挂到这款、但没对上模板词的实测</p>
            <ul className="space-y-1 text-sm">
              {state.measured
                .filter((row) => row.productId === product.id && !rows.some((item) => normalizeKeyword(item.keyword) === normalizeKeyword(row.keyword)))
                .map((row) => (
                  <li key={row.id}>
                    {row.keyword} · {row.source} · 月搜索 {row.monthlySearches ?? "未知"}
                    {row.cpc != null ? ` · CPC $${row.cpc}` : ""}
                    {row.trendIndex != null ? ` · 热度 ${row.trendIndex}` : ""}
                    {row.bidLow != null || row.bidHigh != null ? ` · 出价 ${row.bidLow ?? "—"}–${row.bidHigh ?? "—"}` : ""}
                    {" "}<ProvBadge kind="measured" />
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-3 text-sm leading-6">
          <Link className="underline underline-offset-2" href={`/data?keyword=${encodeURIComponent(product.nameEn)}&market=${workspace.market}`}>
            到数据工位用 AnswerThePublic 查「{product.nameEn}」
          </Link>
          。打开页面只检查额度，不会创建检索。查到并写入词表后，对得上的词在这里标成实测，来源写 AnswerThePublic。
        </p>
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium">把关键字规划师表贴在这里</p>
          <Textarea value={paste} rows={4} placeholder={"Keyword\tAvg. monthly searches\tCompetition\tTop of page bid (low range)\tTop of page bid (high range)"} onChange={(event) => setPaste(event.target.value)} />
          <Button size="sm" onClick={ingest}>记为实测</Button>
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle kicker="SERP" title={`${INTENT_MAP[intent].name}的竞争阅读`} action={<ProvBadge kind="sample" />} />
        <p className="mb-3 text-sm leading-6">{serpVerdict(intent)}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-muted-foreground"><tr className="border-b"><th className="py-2">位</th><th>类型</th><th>示例称呼</th><th>怎么用</th></tr></thead>
            <tbody>
              {serp.map((row) => (
                <tr key={row.position} className="border-b last:border-0">
                  <td className="py-2 pr-2">{row.position}</td>
                  <td className="py-2 pr-2">{row.type}</td>
                  <td className="py-2 pr-2">{row.title}</td>
                  <td className="py-2 text-muted-foreground">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">上表是讲解结构，不是这次搜索的前十，也没有编造真实网站的流量。你自己的观察请到数据工位粘贴。</p>
        {state.serp.filter((row) => row.productId === product.id).length ? (
          <div className="mt-3">
            <p className="mb-1 text-sm font-medium">你贴过的 SERP <ProvBadge kind="measured" /></p>
            <ul className="text-sm">
              {state.serp.filter((row) => row.productId === product.id).slice(0, 10).map((row) => (
                <li key={row.id}>{row.position}. {row.title} · {row.type}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="风险与未知" />
          <ul className="list-disc space-y-1 pl-4 text-sm leading-6">
            {product.risks.map((item) => <li key={item}>{item}</li>)}
            {product.unknowns.map((item) => <li key={item}>未知：{item}</li>)}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">常见买家：{product.buyers.join("、")}。季节说明：{product.seasonNote}</p>
        </Card>
        <Card className="p-4">
          <SectionTitle title="合规清单" action={<ProvBadge kind="verify" />} />
          <p className="mb-2 text-sm text-muted-foreground">这些是常见需要向工厂或实验室核对的项目，不是准入结论。勾选表示你已经问过，系统不会改写成「已通过」。</p>
          <div className="space-y-2">
            {product.compliance.map((label) => {
              const check = state.checks[product.id]?.[label];
              return (
                <label key={label} className="flex items-start gap-2 text-sm">
                  <Checkbox checked={Boolean(check?.marked)} onCheckedChange={(marked) => setCheck(product.id, label, { marked: Boolean(marked) })} />
                  <span>
                    {label}
                    {check?.marked ? <ProvBadge kind="user" className="ml-2" /> : <ProvBadge kind="verify" className="ml-2" />}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle title="内部笔记" />
        <NoteBox
          key={product.id}
          initial={state.notes[product.id] ?? ""}
          onSave={(body) => {
            setNote(product.id, body);
            toast.success("笔记已保存");
          }}
        />
      </Card>
    </div>
  );
}

function NoteBox({ initial, onSave }: { initial: string; onSave: (body: string) => void }) {
  const [note, setNote] = useState(initial);
  return (
    <>
      <Textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="样品结论、客户反馈、哪家档口看过。只存在这台浏览器。" />
      <Button className="mt-2" size="sm" onClick={() => onSave(note)}>保存笔记</Button>
    </>
  );
}

function Metric({ label, value, kind }: { label: string; value: string; kind: "sample" | "unknown" | "assumption" }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{label}</p><ProvBadge kind={kind} /></div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </Card>
  );
}

function Bar({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <li>
      <div className="mb-1 flex justify-between text-xs"><span>{label} · {weight}</span><span>{Math.round(value)}</span></div>
      <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} /></div>
    </li>
  );
}

export function CatalogScreen() {
  const { settings, workspace, toggleCompare } = useStore();
  const list = PRODUCTS.filter((product) => settings.categories.includes(product.category)).filter((product) => workspace.category === "all" || product.category === workspace.category);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">单品分析</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">先从目录点进一款。示例数字用来练手，实测从关键字规划师贴进去之后才会盖住对应的词。</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((product) => {
          const scored = scoreProduct(product, workspace.market);
          return (
            <Card key={product.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{CATEGORY_MAP[product.category].name}</p>
                  <Link href={`/products/${product.id}`} className="text-lg font-semibold hover:underline">{product.nameZh}</Link>
                  <p className="text-sm text-muted-foreground">{product.nameEn}</p>
                </div>
                {scored ? <GradeMark grade={scored.grade} /> : <ProvBadge kind="unknown" />}
              </div>
              <p className="mt-2 text-sm leading-6">{product.summary}</p>
              <div className="mt-3 flex gap-2">
                <LinkButton href={`/products/${product.id}`} size="sm">打开</LinkButton>
                <Button size="sm" variant="outline" onClick={() => toggleCompare(product.id)}>对比</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
