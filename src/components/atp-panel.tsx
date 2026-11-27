"use client";

import { FieldSelect, ProvBadge, SectionTitle } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ATP_BUCKETS,
  ATP_LANGUAGES,
  ATP_MARKETS,
  ATP_PROVIDERS,
  ATP_REGIONS,
  bucketLabel,
  outcomeLabel,
  presetForDesk,
  providerLabel,
  regionLabel,
  statusLabel,
  type AtpBucket,
} from "@/lib/atp/constants";
import { intentLabel, sentimentLabel } from "@/lib/atp/messages";
import { getAtpSession, getServerAtpSession, sessionFromCreate, subscribeAtpSession, writeAtpSession, type AtpSession } from "@/lib/atp/session";
import type { AtpAccountResponse, AtpKeywordRow, AtpProgressResponse, AtpPublicError, AtpReportResponse, AtpSearchResponse, RateHint } from "@/lib/atp/types";
import { assignCustomerPhrase } from "@/lib/keyword-origin";
import { matchProductId } from "@/lib/match-product";
import { useStore } from "@/lib/storage";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function money(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function mergeRows(current: AtpKeywordRow[], incoming: AtpKeywordRow[]) {
  const map = new Map<string, AtpKeywordRow>();
  for (const row of [...current, ...incoming]) {
    const key = [row.provider ?? "", row.bucket, row.modifier ?? "", row.keyword.toLowerCase()].join("|");
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

export function AtpPanel({ initialKeyword, initialMarket }: { initialKeyword: string; initialMarket: string }) {
  const preset = presetForDesk(initialMarket);
  const { addMeasured, state } = useStore();
  const [keyword, setKeyword] = useState(initialKeyword);
  const [marketId, setMarketId] = useState<string>(preset?.id ?? "unset");
  const [language, setLanguage] = useState<string>(preset?.language ?? "");
  const [region, setRegion] = useState<string>(preset?.region ?? "");
  const [provider, setProvider] = useState("gweb");
  const [account, setAccount] = useState<AtpAccountResponse | AtpPublicError | null>(null);
  const [checking, setChecking] = useState(true);
  const session = useSyncExternalStore(subscribeAtpSession, getAtpSession, getServerAtpSession);
  const [running, setRunning] = useState(false);
  const [statusText, setStatusText] = useState("打开页面时只检查额度和配置，不会创建检索。");
  const [bucket, setBucket] = useState<AtpBucket>("questions");
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [rate, setRate] = useState<RateHint | null>(null);
  const alive = useRef(true);
  const stopRef = useRef(false);

  async function refreshAccount(quiet = false) {
    if (!quiet) setChecking(true);
    try {
      const response = await fetch("/api/answerthepublic/status");
      const body = (await response.json()) as AtpAccountResponse | AtpPublicError;
      if (!alive.current) return;
      setAccount(body);
    } catch {
      if (!alive.current) return;
      setAccount({
        ok: false,
        configured: false,
        code: "network",
        message: "没有读到额度接口。粘贴录入仍可使用。",
        resetsAt: null,
        retryAfterSeconds: null,
      });
    } finally {
      if (alive.current && !quiet) setChecking(false);
    }
  }

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    fetch("/api/answerthepublic/status", { signal: controller.signal })
      .then((response) => response.json())
      .then((body: AtpAccountResponse | AtpPublicError) => {
        if (!alive.current) return;
        setAccount(body);
      })
      .catch(() => {
        if (!alive.current) return;
        setAccount({
          ok: false,
          configured: false,
          code: "network",
          message: "没有读到额度接口。粘贴录入仍可使用。",
          resetsAt: null,
          retryAfterSeconds: null,
        });
      })
      .finally(() => {
        if (alive.current) setChecking(false);
      });
    return () => {
      alive.current = false;
      stopRef.current = true;
      controller.abort();
    };
  }, []);

  function remember(next: AtpSession) {
    writeAtpSession(next);
  }

  async function loadReport(current: AtpSession, page: number, grouped: boolean) {
    if (alive.current) setStatusText("正在读取报告。这一步计入今日读取额度，不再扣搜索额度。");
    const params = new URLSearchParams({ page: String(page), grouped: grouped ? "1" : "0" });
    if (current.provider) params.set("provider", current.provider);
    const response = await fetch(`/api/answerthepublic/reports/${current.parentSearchId}?${params.toString()}`);
    const body = (await response.json()) as AtpReportResponse | AtpPublicError;
    if (!alive.current) return;
    if (!body.ok) {
      setStatusText(body.message);
      return;
    }
    const previous = page > 1 ? current.report?.rows ?? [] : [];
    const rows = page > 1 ? mergeRows(previous, body.rows) : body.rows;
    const added = rows.length - previous.length;
    const next: AtpSession = {
      ...current,
      report: {
        rows,
        withheldCount: body.withheldCount,
        truncated: body.truncated,
        outcomes: body.outcomes,
        shapeKeys: body.shapeKeys,
        page: body.page,
        grouped: body.grouped,
        readAt: new Date().toISOString(),
      },
    };
    remember(next);
    if (!rows.length) {
      setStatusText("报告已返回，但没有识别到可展示的词。没有把其他数字猜成搜索量。");
      return;
    }
    if (page > 1 && added === 0) {
      setStatusText("这一页没有新的词。");
      return;
    }
    if (page === 1) setBucket(rows.some((row) => row.bucket === "questions") ? "questions" : rows[0].bucket);
    setStatusText(`${current.message} 下面的词、月搜索和 CPC 标为实测，来源是 AnswerThePublic。接口没给的格子保持未知。`);
  }

  async function follow(current: AtpSession) {
    let next = current;
    const started = Date.now();
    if (!next.searches.length) {
      if (next.status === "completed" || next.status === "failed") {
        await loadReport(next, 1, true);
        return;
      }
      if (alive.current) {
        setStatusText("检索已提交，但没有返回分平台编号。请稍后用同一个词再查，24 小时内会复用，不重复扣搜索额度。");
      }
      return;
    }
    while (!stopRef.current && Date.now() - started < 10 * 60 * 1000) {
      const pending = next.searches.filter((item) => item.status === "loading" || item.status === "pending");
      if (!pending.length) break;
      if (alive.current) {
        setStatusText(`${pending.map((item) => `${providerLabel(item.provider)} ${statusLabel(item.status)}`).join("，")}。正在查看进度，不会创建新检索。`);
      }
      const response = await fetch("/api/answerthepublic/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pending.map((item) => item.id) }),
      });
      const body = (await response.json()) as AtpProgressResponse | AtpPublicError;
      if (!alive.current || stopRef.current) return;
      if (!body.ok) {
        setStatusText(body.message);
        return;
      }
      const byId = new Map(body.searches.map((item) => [item.id, item]));
      const searches = next.searches.map((item) => {
        const polled = byId.get(item.id);
        return polled ? { ...item, status: polled.status, provider: polled.provider ?? item.provider } : item;
      });
      const statuses = searches.map((item) => item.status);
      const status = statuses.every((item) => item === "completed")
        ? "completed"
        : statuses.every((item) => item === "completed" || item === "failed")
          ? "failed"
          : "loading";
      next = { ...next, searches, status };
      remember(next);
      const hint = body.searches.find((item) => item.suggestedKeyword);
      if (hint?.suggestedKeyword && alive.current) {
        const kind = hint.suggestedType === "spelling" ? "拼写" : hint.suggestedType === "shorter" ? "更短的词" : "改写";
        setStatusText(`平台没有直接建议，但提示可改成「${hint.suggestedKeyword}」（${kind}）。这不是搜索量。`);
      }
      if (status === "completed" || status === "failed") break;
      await sleep(next.searches.length > 1 ? 12_000 : 4_000);
    }
    if (!alive.current || stopRef.current) return;
    if (next.status !== "completed" && next.status !== "failed") {
      setStatusText("已查看约 10 分钟，报告还没完成。点「继续查看」会接着查进度，不会重新创建检索，也不会把未返回的搜索量写成 0。");
      return;
    }
    await loadReport(next, 1, true);
  }

  async function runSearch() {
    if (running) return;
    const seed = keyword.trim();
    if (!seed) {
      setStatusText("请先填写种子关键词。这次没有创建检索。");
      return;
    }
    if (!language || !region || marketId === "unset") {
      setStatusText("请先选择 AnswerThePublic 能查的市场和语言。韩语不会改用英语。这次没有创建检索。");
      return;
    }
    stopRef.current = false;
    setRunning(true);
    setStatusText("正在创建检索…");
    try {
      const response = await fetch("/api/answerthepublic/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: seed,
          language,
          region,
          provider: provider === "all" ? null : provider,
        }),
      });
      const body = (await response.json()) as AtpSearchResponse | AtpPublicError;
      if (!alive.current) return;
      if (!body.ok) {
        setStatusText(body.message);
        return;
      }
      setRate(body.rate);
      const created = sessionFromCreate(body, {
        language,
        region,
        provider: provider === "all" ? null : provider,
      });
      remember(created);
      const rateText = body.rate?.remaining != null
        ? ` 响应里的搜索剩余约 ${body.rate.remaining.toLocaleString("zh-CN")}${body.rate.limit != null ? ` / ${body.rate.limit.toLocaleString("zh-CN")}` : ""}。`
        : "";
      setStatusText(`${body.message}${rateText}`);
      void refreshAccount(true);
      await follow(created);
    } catch {
      if (alive.current) setStatusText("浏览器没有送到检索接口。请再试一次。如果刚才那次其实已创建，用同一个词再查会在 24 小时内复用。");
    } finally {
      if (alive.current) setRunning(false);
    }
  }

  async function resume() {
    if (!session || running) return;
    stopRef.current = false;
    setRunning(true);
    try {
      if (session.status === "completed" || session.status === "failed" || session.searches.every((item) => item.status === "completed" || item.status === "failed")) {
        await loadReport(session, session.report?.page ?? 1, session.report?.grouped ?? true);
        return;
      }
      await follow(session);
    } finally {
      if (alive.current) setRunning(false);
    }
  }

  function saveBucket() {
    const rows = visibleRows;
    if (!session || !rows.length) {
      toast.error("当前分组没有可写入的词。");
      return;
    }
    const capped = rows.slice(0, 200);
    addMeasured(capped.map((row) => ({
      keyword: row.keyword,
      monthlySearches: row.searchVolume,
      competition: null,
      bidLow: null,
      bidHigh: null,
      bidCurrency: null,
      trendIndex: null,
      cpc: row.cpc,
      atpBucket: row.bucket,
      source: `AnswerThePublic · ${providerLabel(row.provider)}`,
      origin: "answerthepublic",
      customerId: state.assignCustomerId,
      productId: matchProductId(row.keyword),
      note: [
        bucketLabel(row.bucket),
        row.modifier,
        intentLabel(row.intent),
        sentimentLabel(row.sentiment),
        `${session.language}-${session.region}`,
        "搜索量和 CPC 来自 AnswerThePublic。没有数字的记为未知，不是 0。CPC 不是页首出价，也不是广告账户实际花费。",
      ].filter(Boolean).join(" · "),
    })));
    toast.success(`已写入 ${capped.length} 条实测。来源 AnswerThePublic，客户 ${assignCustomerPhrase(state.customers, state.assignCustomerId)}。`);
  }

  const configured = account?.ok === true;
  const report = session?.report ?? null;
  const bucketRows = (report?.rows ?? []).filter((row) => row.bucket === bucket);
  const filteredRows = bucketRows.filter((row) => !filter.trim() || row.keyword.toLowerCase().includes(filter.trim().toLowerCase()));
  const visibleRows = showAll ? filteredRows : filteredRows.slice(0, 80);
  const multipleProviders = new Set((report?.rows ?? []).map((row) => row.provider).filter(Boolean)).size > 1;
  const coerced = session != null && (session.language !== session.requestedLanguage || session.region !== session.requestedRegion);
  const counts = Object.fromEntries(ATP_BUCKETS.map((item) => [item, (report?.rows ?? []).filter((row) => row.bucket === item).length]));

  return (
    <Card className="p-4">
      <SectionTitle title="AnswerThePublic 检索" action={<ProvBadge kind={report?.rows.length ? "measured" : "unknown"} />} />
      <p className="text-sm leading-6 text-muted-foreground">
        输入种子词，选择语言和地区，再点「开始检索」。打开本页只检查配置和剩余额度，不会创建检索，也不会扣搜索额度。相同关键词、语言、地区在 24 小时内由接口复用，不重复扣费。返回的词、月搜索和 CPC 标为实测，来源写 AnswerThePublic；没返回的数字保持未知。
      </p>
      <div className="mt-3 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1 text-sm md:col-span-2 xl:col-span-3">
            种子关键词
            <Input
              value={keyword}
              maxLength={255}
              placeholder="例如 silicone utensil 或 ワイヤレスイヤホン"
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void runSearch();
                }
              }}
            />
          </label>
          <label className="space-y-1 text-sm">
            市场
            <FieldSelect
              value={marketId}
              onChange={(value) => {
                setMarketId(value);
                const next = ATP_MARKETS.find((item) => item.id === value);
                if (!next) return;
                setLanguage(next.language);
                setRegion(next.region);
              }}
              options={[
                ...(marketId === "unset" ? [{ value: "unset", label: "请选择市场" }] : []),
                ...ATP_MARKETS.map((item) => ({ value: item.id, label: item.label })),
              ]}
            />
          </label>
          <label className="space-y-1 text-sm">
            语言
            {language ? (
              <FieldSelect value={language} onChange={setLanguage} options={ATP_LANGUAGES.map((item) => ({ value: item.id, label: item.label }))} />
            ) : (
              <p className="text-sm text-muted-foreground">先选市场。不会默认成英语。</p>
            )}
          </label>
          <label className="space-y-1 text-sm">
            地区
            {region ? (
              <FieldSelect value={region} onChange={setRegion} options={ATP_REGIONS.map((item) => ({ value: item.id, label: item.label }))} />
            ) : (
              <p className="text-sm text-muted-foreground">先选市场。</p>
            )}
          </label>
          <label className="space-y-1 text-sm md:col-span-2 xl:col-span-3">
            平台
            <FieldSelect
              value={provider}
              onChange={setProvider}
              options={[
                ...ATP_PROVIDERS.map((item) => ({ value: item.id, label: item.label })),
                { value: "all", label: "全部平台（每个平台各算一次额度）" },
              ]}
            />
          </label>
        </div>
        {initialMarket === "KR" ? (
          <p className="rounded-lg border border-dashed px-3 py-2 text-sm leading-6">
            义乌洲凯选品台当前市场是韩国。AnswerThePublic 的关键词检索没有韩语，这里不会改用英语或美国代替。韩语搜索量请用下面的 DataForSEO，地区选韩国，语言选韩语。
          </p>
        ) : null}
        <p className="text-xs leading-5 text-muted-foreground">
          默认只查谷歌网页，避免一次把每个平台都扣掉。英国用 gb。中东不是单一地区，请选阿联酋或沙特。西班牙和墨西哥分开，葡萄牙和巴西分开。
          {provider === "tiktok" || provider === "instagram" || provider === "all"
            ? " TikTok 和 Instagram 只认全球流，接口会把地区改成 us；Instagram 还会把语言改成 en。"
            : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={checking || running || !configured || !keyword.trim() || marketId === "unset" || !language || !region} onClick={() => void runSearch()}>
            {running ? "检索中…" : "开始检索"}
          </Button>
          <Button variant="outline" disabled={checking} onClick={() => void refreshAccount()}>
            {checking ? "正在检查额度…" : "查看额度"}
          </Button>
          {session && !running ? (
            <Button variant="outline" onClick={() => void resume()}>
              {session.report ? "重新读取报告" : "继续查看"}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 space-y-1 text-sm leading-6" aria-live="polite">
        {checking ? <p>正在检查 AnswerThePublic 配置和额度…</p> : null}
        {account?.ok ? (
          <p>
            工作区 {account.workspaceName ?? "未命名"} · 套餐标签 {account.tierLabel}
            {account.apiVersion ? ` · API ${account.apiVersion}` : ""}。{account.searchesLine}。{account.readsLine}。{account.note}
          </p>
        ) : null}
        {account && !account.ok ? <p>{account.message}</p> : null}
        <p>{statusText}</p>
        {rate?.remaining != null ? <p>最近一次创建响应里的搜索剩余约 {rate.remaining.toLocaleString("zh-CN")}。</p> : null}
      </div>
      {session ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{session.keyword}</span>
            <span className="text-muted-foreground">{session.language} / {regionLabel(session.region)} · {providerLabel(session.provider)} · {statusLabel(session.status)}</span>
            <ProvBadge kind="measured" />
          </div>
          {coerced ? (
            <p className="text-xs leading-5 text-muted-foreground">
              接口使用的是 {session.language} / {session.region}，和表单里的 {session.requestedLanguage} / {session.requestedRegion} 不一样。TikTok、Instagram 会出现这种改写。
            </p>
          ) : null}
          {report ? (
            <>
              <p className="text-xs leading-5 text-muted-foreground">
                读取于 {new Date(report.readAt).toLocaleString("zh-CN", { hour12: false })}。来源 AnswerThePublic。关闭页面后，这次结果还留在本浏览器里，再次打开不会自动重读。
                {report.withheldCount > 0 ? ` 接口标明扣留了 ${report.withheldCount.toLocaleString("zh-CN")} 条，套餐可能不会返回全部建议。没出现的词不要当成搜索量 0。` : ""}
                {report.truncated ? " 为避免页面过重，这里只保留前 800 条。" : ""}
              </p>
              {report.outcomes.length ? (
                <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                  {report.outcomes.map((item) => (
                    <li key={`${item.provider}-${item.outcome}-${item.suggestedKeyword}`}>
                      {providerLabel(item.provider)} · {outcomeLabel(item.outcome)}
                      {item.refreshing ? " · 仍在刷新" : ""}
                      {item.suggestedKeyword ? ` · 可改成「${item.suggestedKeyword}」` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {ATP_BUCKETS.map((item) => (
                  <Button key={item} size="sm" variant={bucket === item ? "default" : "outline"} onClick={() => { setBucket(item); setShowAll(false); }}>
                    {bucketLabel(item)} {counts[item] ?? 0}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="max-w-xs" value={filter} placeholder="在当前分组里筛词" onChange={(event) => setFilter(event.target.value)} />
                <Button size="sm" onClick={saveBucket}>写入当前列表到实测词表</Button>
                {report.rows.length >= 200 ? (
                  <Button size="sm" variant="outline" disabled={running} onClick={() => void loadReport(session, report.page + 1, report.grouped)}>
                    再读下一页
                  </Button>
                ) : null}
                {!report.grouped ? null : report.rows.length === 0 ? (
                  <Button size="sm" variant="outline" disabled={running} onClick={() => void loadReport(session, 1, false)}>
                    换扁平结构再读一次
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">写入关键词库后，单品页能对上的词会用实测盖住示例。来源写成 AnswerThePublic，客户归到 {assignCustomerPhrase(state.customers, state.assignCustomerId)}。再读下一页或换结构都会再计一次读取额度。</p>
              {visibleRows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-2">词</th>
                        <th className="py-2 pr-2">修饰</th>
                        {multipleProviders ? <th className="py-2 pr-2">平台</th> : null}
                        <th className="py-2 pr-2">月搜索</th>
                        <th className="py-2 pr-2">CPC</th>
                        <th className="py-2 pr-2">意图</th>
                        <th className="py-2">情绪</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr key={`${row.provider}-${row.modifier}-${row.keyword}`} className="border-b align-top">
                          <td className="py-2 pr-2">
                            {row.keyword}
                            <span className="mt-1 block"><ProvBadge kind="measured" /></span>
                          </td>
                          <td className="py-2 pr-2">{row.modifier ?? "—"}</td>
                          {multipleProviders ? <td className="py-2 pr-2">{providerLabel(row.provider)}</td> : null}
                          <td className="py-2 pr-2">
                            {row.searchVolume == null ? "未知" : row.searchVolume.toLocaleString("zh-CN")}
                            <span className="ml-1"><ProvBadge kind={row.searchVolume == null ? "unknown" : "measured"} /></span>
                          </td>
                          <td className="py-2 pr-2">
                            {row.cpc == null ? "未知" : money(row.cpc)}
                            <span className="ml-1"><ProvBadge kind={row.cpc == null ? "unknown" : "measured"} /></span>
                          </td>
                          <td className="py-2 pr-2">{intentLabel(row.intent) ?? "未知"}</td>
                          <td className="py-2">{sentimentLabel(row.sentiment) ?? "未知"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">这一组没有词。没有返回的搜索量保持未知，不会补 0。</p>
              )}
              {filteredRows.length > 80 && !showAll ? (
                <Button size="sm" variant="outline" onClick={() => setShowAll(true)}>显示本组其余 {filteredRows.length - 80} 条</Button>
              ) : null}
              {report.rows.length === 0 && report.shapeKeys.length ? (
                <p className="text-xs leading-5 text-muted-foreground">报告顶层字段：{report.shapeKeys.join("、")}。这些字段名不是搜索量。</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">检索还没有可读的报告。完成前不会出现搜索量。</p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
