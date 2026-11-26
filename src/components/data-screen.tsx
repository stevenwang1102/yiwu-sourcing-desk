"use client";

import { ProvBadge, SectionTitle } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCTS } from "@/lib/catalog";
import { normalizeKeyword, parseKeywordPaste, parseSerpPaste } from "@/lib/parse-metrics";
import { DATA_SOURCES } from "@/lib/sources";
import { useStore } from "@/lib/storage";
import { useState } from "react";
import { toast } from "sonner";

export function DataScreen() {
  const { state, addMeasured, removeMeasured, addSerp, removeSerp } = useStore();
  const [source, setSource] = useState<"Keyword Planner" | "Google Trends">("Keyword Planner");
  const [text, setText] = useState("");
  const [serpText, setSerpText] = useState("");
  const [serpKeyword, setSerpKeyword] = useState("");
  const [status, setStatus] = useState("还没有检查接口。");

  const linked = state.measured.filter((row) => row.productId).length;
  const withVolume = state.measured.filter((row) => row.monthlySearches != null).length;
  const withTrend = state.measured.filter((row) => row.trendIndex != null).length;

  function pasteKeywords() {
    const parsed = parseKeywordPaste(text, source);
    if (!parsed.rows.length) {
      toast.error(parsed.warnings.join(" "));
      return;
    }
    addMeasured(parsed.rows.map((row) => ({
      ...row,
      source,
      productId: guessProduct(row.keyword),
      note: source === "Google Trends" ? "相对热度，不是搜索量" : "页首出价是广告出价区间",
    })));
    toast.success(`写入 ${parsed.rows.length} 行。${parsed.warnings.join(" ")}`);
    setText("");
  }

  function pasteSerp() {
    const parsed = parseSerpPaste(serpText, serpKeyword);
    if (!parsed.rows.length) {
      toast.error(parsed.warnings[0] ?? "没有行");
      return;
    }
    addSerp(parsed.rows.map((row) => ({ ...row, source: "手工搜索", productId: guessProduct(row.keyword) })));
    toast.success(`写入 ${parsed.rows.length} 条当次观察`);
    setSerpText("");
  }

  async function checkApi() {
    const response = await fetch("/api/stubs/keyword-metrics");
    const body = await response.json();
    setStatus(`${response.status} · ${body.message ?? body.note ?? "无说明"}`);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Data desk</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">数据工位</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          把工具里导出的表贴进来。贴上来的才标实测；空着的保持未知；目录里原来的数字继续标示例。这里不会自动改用示例去填空。
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="实测词行" value={state.measured.length} kind={state.measured.length ? "measured" : "unknown"} />
        <Stat label="其中有月搜索" value={withVolume} kind={withVolume ? "measured" : "unknown"} />
        <Stat label="其中有 Trends 热度" value={withTrend} kind={withTrend ? "measured" : "unknown"} />
        <Stat label="已挂到单品" value={linked} kind={linked ? "catalog" : "unknown"} />
      </div>
      {!state.measured.length ? (
        <Card className="p-4 text-sm leading-6">
          还没有实测。打开 Google Ads → 工具 → 关键字规划师，选目标国家和语言，导出关键字、月均搜索量、竞争程度、页首出价低/高。不要把 Semrush 的估算和规划师的次数贴成同一列还不改来源。
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle title="粘贴关键字或趋势" />
          <div className="mb-2 flex gap-2">
            <Button size="sm" variant={source === "Keyword Planner" ? "default" : "outline"} onClick={() => setSource("Keyword Planner")}>关键字规划师</Button>
            <Button size="sm" variant={source === "Google Trends" ? "default" : "outline"} onClick={() => setSource("Google Trends")}>Google Trends</Button>
          </div>
          <Textarea rows={8} value={text} onChange={(event) => setText(event.target.value)} placeholder={source === "Keyword Planner" ? "关键字\t月均搜索量\t竞争程度\t页首出价（低价位）\t页首出价（高价位）" : "关键字\t热度"} />
          <Button className="mt-2" onClick={pasteKeywords}>写入实测</Button>
        </Card>
        <Card className="p-4">
          <SectionTitle title="粘贴当次搜索结果" />
          <Input className="mb-2" value={serpKeyword} placeholder="这批结果对应的检索词，例如 wholesale silicone utensils" onChange={(event) => setSerpKeyword(event.target.value)} />
          <Textarea rows={6} value={serpText} onChange={(event) => setSerpText(event.target.value)} placeholder={"排名\t标题\t链接\t类型"} />
          <Button className="mt-2" onClick={pasteSerp}>写入观察</Button>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">没看到广告就留空。不要为了凑十行去编。</p>
        </Card>
      </div>
      <Card className="p-4">
        <SectionTitle title="已录入" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b"><th className="py-2">词</th><th>来源</th><th>月搜索</th><th>热度</th><th>出价</th><th>单品</th><th></th></tr>
            </thead>
            <tbody>
              {state.measured.slice(0, 40).map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2 pr-2">{row.keyword}</td>
                  <td className="py-2 pr-2">{row.source}</td>
                  <td className="py-2 pr-2">{row.monthlySearches ?? "未知"}</td>
                  <td className="py-2 pr-2">{row.trendIndex ?? "—"}</td>
                  <td className="py-2 pr-2">{row.bidLow ?? "—"}–{row.bidHigh ?? "—"} {row.bidCurrency ?? ""}</td>
                  <td className="py-2 pr-2">{row.productId ? PRODUCTS.find((item) => item.id === row.productId)?.nameZh ?? row.productId : "未挂上"}</td>
                  <td className="py-2"><Button size="sm" variant="ghost" onClick={() => removeMeasured(row.id)}>移除</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {state.serp.length ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">SERP 观察 {state.serp.length} 行</p>
            <ul className="space-y-1 text-sm">
              {state.serp.slice(0, 12).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2">
                  <span>{row.keyword} · {row.position}. {row.title}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeSerp(row.id)}>移除</Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
      <Card className="p-4">
        <SectionTitle title="数据来源对照" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-muted-foreground"><tr className="border-b"><th className="py-2">想回答</th><th>用什么</th><th>得到什么</th><th>不能当成什么</th></tr></thead>
            <tbody>
              {DATA_SOURCES.map((row) => (
                <tr key={row.question} className="border-b align-top">
                  <td className="py-2 pr-3">{row.question}</td>
                  <td className="py-2 pr-3">{row.tool}</td>
                  <td className="py-2 pr-3">{row.gives}</td>
                  <td className="py-2 text-muted-foreground">{row.not}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-4">
        <SectionTitle title="以后接关键字接口" action={<ProvBadge kind="unknown" />} />
        <p className="text-sm leading-6 text-muted-foreground">
          v1 只留一个不会外呼的状态检查。即使服务器上有环境变量，这个按钮也不会向 DataForSEO 或 Google 发请求，因此不会扣费。密钥不要写进仓库。
        </p>
        <Button className="mt-3" variant="outline" onClick={checkApi}>检查接口状态</Button>
        <p className="mt-2 text-sm">{status}</p>
      </Card>
    </div>
  );
}

function Stat({ label, value, kind }: { label: string; value: number; kind: "measured" | "unknown" | "catalog" }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><ProvBadge kind={kind} /></div>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}

function guessProduct(keyword: string) {
  const text = normalizeKeyword(keyword);
  let best: { id: string; len: number } | null = null;
  for (const product of PRODUCTS) {
    for (const term of [product.nameEn, ...product.aliases]) {
      const needle = term.toLowerCase();
      if (needle.length >= 4 && text.includes(needle) && (!best || needle.length > best.len)) best = { id: product.id, len: needle.length };
    }
  }
  return best?.id ?? null;
}
