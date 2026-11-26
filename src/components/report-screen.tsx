"use client";

import { GradeMark, ProvBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { getProduct } from "@/lib/catalog";
import { formatRange } from "@/lib/format";
import { CATEGORY_MAP, marketName } from "@/lib/markets";
import { INQUIRY_FORMULA, SCORE_FORMULA } from "@/lib/sources";
import { scoreProduct } from "@/lib/scoring";
import { useStore } from "@/lib/storage";
import { useSyncExternalStore } from "react";

let reportDate = "";
function subscribeReportDate(onStoreChange: () => void) {
  const timer = window.setTimeout(() => {
    reportDate = new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(new Date());
    onStoreChange();
  }, 0);
  return () => window.clearTimeout(timer);
}
function readReportDate() {
  return reportDate;
}

export function ReportScreen() {
  const { state, settings, workspace, setReportProducts } = useStore();
  const printedAt = useSyncExternalStore(subscribeReportDate, readReportDate, () => "");
  const saved = state.cases.find((item) => item.id === workspace.reportCaseId) ?? null;
  const ids = workspace.reportProductIds.length ? workspace.reportProductIds : saved?.selectedProductIds ?? [];
  const products = ids.map((id) => getProduct(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">选品报告</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">一页给同事或客户经理。打印对话框里选「另存为 PDF」。示例、实测、未知和假设会一起出现在页脚，避免装订之后看不出哪一列是真的。</p>
        </div>
        <Button onClick={() => window.print()}>打印 / 导出 PDF</Button>
      </div>
      <div className="no-print flex flex-wrap gap-2">
        {state.cases.map((item) => (
          <Button key={item.id} size="sm" variant={item.id === saved?.id ? "default" : "outline"} onClick={() => setReportProducts(item.selectedProductIds, item.id)}>
            {item.inquiry.sampleCase ? "示例案例" : item.inquiry.title}
          </Button>
        ))}
      </div>
      {!products.length ? (
        <p className="text-sm text-muted-foreground">还没有放进报告的单品。在大盘、推荐或行情里点「放入报告」。</p>
      ) : (
        <article className="report-sheet mx-auto max-w-[920px] bg-white p-6 text-zinc-900 shadow-sm ring-1 ring-black/10 print:max-w-none print:shadow-none print:ring-0 dark:bg-zinc-50">
          <header className="flex items-start justify-between gap-4 border-b border-zinc-300 pb-3">
            <div>
              <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Selection note</p>
              <h2 className="text-2xl font-semibold">{settings.companyName}</h2>
              <p className="text-sm">选品建议 · {marketName(workspace.market)} · {printedAt || "日期在打开后生成"}</p>
            </div>
            <p className="max-w-[240px] text-right text-xs leading-5 text-zinc-600">市场采购建议，不是工厂身份，也不是检测报告。认证一律需核实。</p>
          </header>
          {saved ? (
            <section className="mt-3">
              <h3 className="text-sm font-semibold">客户需求</h3>
              <p className="text-sm leading-6">{saved.inquiry.customer || "未写客户名"} · {marketName(saved.inquiry.market)} · {saved.inquiry.requirements}</p>
              {saved.inquiry.sampleCase ? <p className="text-xs text-amber-800">此案例是预置示例，不是真实询盘。</p> : null}
            </section>
          ) : null}
          <section className="mt-3">
            <h3 className="text-sm font-semibold">机会表</h3>
            <table className="mt-1 w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-300">
                  <th className="py-1">单品</th><th>类目</th><th>指数</th><th>示例价带</th><th>起订</th><th>交期</th><th>数据</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const scored = scoreProduct(product, workspace.market);
                  return (
                    <tr key={product.id} className="border-b border-zinc-200 align-top">
                      <td className="py-1 pr-2"><b>{product.nameZh}</b><div className="text-zinc-500">{product.nameEn}</div></td>
                      <td className="py-1">{CATEGORY_MAP[product.category].name}</td>
                      <td className="py-1">{scored ? <span className="inline-flex items-center gap-1"><GradeMark grade={scored.grade} />{scored.index}</span> : "未知"}</td>
                      <td className="py-1">{formatRange(product.priceUsd, { ...settings, currency: "USD" })}</td>
                      <td className="py-1">{product.moq}</td>
                      <td className="py-1">{product.leadDays[0]}–{product.leadDays[1]} 天</td>
                      <td className="py-1">示例</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          <section className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">为什么这样推</h3>
              <ul className="mt-1 list-disc pl-4 text-xs leading-5">
                {(saved?.results.filter((item) => ids.includes(item.productId)).slice(0, 3) ?? products.slice(0, 3).map((product) => ({ productId: product.id, reasons: [product.pitch], risks: product.risks, unknowns: product.unknowns }))).map((item) => (
                  <li key={item.productId}>
                    <b>{getProduct(item.productId)?.nameZh}</b>：{item.reasons.slice(0, 2).join("；")}
                    {item.risks[0] ? ` 风险：${item.risks[0]}` : ""}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold">竞争快照</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-700">
                头词通常是平台和品牌，贸易公司的切口在批发词、样品和交期。本页不引用虚构的竞品流量。前十以数据工位里的当次观察为准；现在已贴 {state.serp.length} 行，实测词 {state.measured.length} 条
                {state.measured.some((row) => row.origin === "answerthepublic")
                  ? `，其中 AnswerThePublic ${state.measured.filter((row) => row.origin === "answerthepublic").length} 条`
                  : ""}
                {state.measured.some((row) => row.origin === "dataforseo")
                  ? `，其中 DataForSEO ${state.measured.filter((row) => row.origin === "dataforseo").length} 条`
                  : ""}
                。
              </p>
            </div>
          </section>
          <section className="mt-3">
            <h3 className="text-sm font-semibold">下一步</h3>
            <ol className="mt-1 list-decimal pl-4 text-xs leading-5">
              <li>按客户市场，用关键字规划师导出批发词，或在数据工位用 AnswerThePublic、DataForSEO 查种子词。只有点了检索并写入词表的才算实测，来源会标明是哪一家。</li>
              <li>向档口要样品、实价、交期，覆盖报告里的示例价带。</li>
              <li>认证只列「需核实」。客户点名的项目，逐项问工厂或实验室，不要把清单抄进合同。</li>
              <li>若客户之后才问独立站，再打开可选的站点提纲。选品本身不依赖建站。</li>
            </ol>
          </section>
          <footer className="mt-3 border-t border-zinc-300 pt-2 text-[11px] leading-5 text-zinc-600">
            <p><ProvBadge kind="sample" /> 价带、起订、交期、搜索量、CPC、难度、趋势、机会指数。</p>
            <p><ProvBadge kind="measured" /> 数据工位粘贴的关键字规划师、Trends、当次搜索，以及写入词表的 AnswerThePublic 和 DataForSEO 结果。来源写在词行上。没返回的数字保持未知。</p>
            <p><ProvBadge kind="unknown" /> 进口额、真实询盘、未贴的当地语言搜索量、未做的检测。</p>
            <p><ProvBadge kind="assumption" /> {INQUIRY_FORMULA}</p>
            <p>{SCORE_FORMULA}</p>
            <p>汇率若显示人民币，按设置里的假设汇率 {settings.fxUsdCny}，不是银行牌价。本报告由 {settings.companyName} 内部使用。</p>
          </footer>
        </article>
      )}
    </div>
  );
}
