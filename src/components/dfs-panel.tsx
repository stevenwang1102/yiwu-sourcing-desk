"use client";

import { FieldSelect, ProvBadge, SectionTitle } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BROWSER_CACHE_TTL_MS, DFS_LANGUAGES, DFS_MARKETS, DFS_MODES, presetForDesk, type DfsMode } from "@/lib/dfs/constants";
import { getDfsSession, getServerDfsSession, sessionFromLookup, subscribeDfsSession, writeDfsSession } from "@/lib/dfs/session";
import type { DfsAccountResponse, DfsKeywordRow, DfsLookupResponse, DfsPublicError } from "@/lib/dfs/types";
import { parseLookupInput } from "@/lib/dfs/validate";
import { matchProductId } from "@/lib/match-product";
import { useStore } from "@/lib/storage";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

const BROWSER_REUSE_NOTE = "这次用的是本浏览器 24 小时内相同条件的结果，没有再次请求 DataForSEO，因此没有再扣查询费。";

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function metricText(value: number | null, asked: boolean, format: (value: number) => string) {
  if (!asked) return { text: "—", known: false, asked: false };
  if (value == null) return { text: "未知", known: false, asked: true };
  return { text: format(value), known: true, asked: true };
}

export function DfsPanel({ initialKeyword, initialMarket }: { initialKeyword: string; initialMarket: string }) {
  const preset = presetForDesk(initialMarket);
  const { addMeasured } = useStore();
  const [text, setText] = useState(initialKeyword);
  const [marketId, setMarketId] = useState<string>(preset.id);
  const [languageCode, setLanguageCode] = useState<string>(preset.languageCode);
  const [mode, setMode] = useState<DfsMode>("volume");
  const [account, setAccount] = useState<DfsAccountResponse | DfsPublicError | null>(null);
  const [checking, setChecking] = useState(true);
  const [running, setRunning] = useState(false);
  const [statusText, setStatusText] = useState("打开页面时只核对账户和价目，不会创建关键字任务。");
  const [filter, setFilter] = useState("");
  const session = useSyncExternalStore(subscribeDfsSession, getDfsSession, getServerDfsSession);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    fetch("/api/dataforseo/status", { signal: controller.signal })
      .then((response) => response.json())
      .then((body: DfsAccountResponse | DfsPublicError) => {
        if (alive) setAccount(body);
      })
      .catch(() => {
        if (!alive) return;
        setAccount({
          ok: false,
          configured: false,
          code: "network",
          message: "没有读到 DataForSEO 账户接口。粘贴录入和 AnswerThePublic 仍可使用。",
          retryAfterSeconds: null,
        });
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    if (window.location.hash === "#dataforseo") {
      document.getElementById("dataforseo")?.scrollIntoView({ block: "start" });
    }
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  async function refreshAccount(quiet = false) {
    if (!quiet) setChecking(true);
    try {
      const response = await fetch("/api/dataforseo/status");
      setAccount((await response.json()) as DfsAccountResponse | DfsPublicError);
    } catch {
      setAccount({
        ok: false,
        configured: false,
        code: "network",
        message: "没有读到 DataForSEO 账户接口。粘贴录入和 AnswerThePublic 仍可使用。",
        retryAfterSeconds: null,
      });
    } finally {
      if (!quiet) setChecking(false);
    }
  }

  function remember(response: DfsLookupResponse, baseMessage: string, savedAt: string) {
    writeDfsSession({ v: 1, savedAt, baseMessage, response });
  }

  async function runSearch(refresh: boolean) {
    if (running) return;
    if (!account || (account.ok === false && account.code !== "network")) {
      setStatusText(account && !account.ok ? account.message : "还在检查账户。这次没有查询。");
      return;
    }
    const parsed = parseLookupInput({ mode, marketId, languageCode, text, refresh });
    if (!parsed.ok) {
      setStatusText(parsed.message);
      return;
    }
    const current = getDfsSession();
    const savedAt = current ? Date.parse(current.savedAt) : Number.NaN;
    if (!refresh && current && current.response.cacheKey === parsed.value.cacheKey && Number.isFinite(savedAt) && Date.now() - savedAt < BROWSER_CACHE_TTL_MS) {
      const response: DfsLookupResponse = {
        ...current.response,
        reused: true,
        charged: false,
        cost: null,
        reuseNote: BROWSER_REUSE_NOTE,
        message: `${BROWSER_REUSE_NOTE}${current.baseMessage}`,
      };
      remember(response, current.baseMessage, current.savedAt);
      setStatusText(BROWSER_REUSE_NOTE);
      return;
    }
    setRunning(true);
    setStatusText(refresh ? "正在重新向 DataForSEO 发一次查询，这一次会计费…" : "正在向 DataForSEO 发一次查询…");
    try {
      const response = await fetch("/api/dataforseo/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, marketId, languageCode, text, refresh }),
      });
      const body = (await response.json()) as DfsLookupResponse | DfsPublicError;
      if (!body.ok) {
        setStatusText(body.message);
        return;
      }
      remember(body, body.message, body.fetchedAt);
      setStatusText(body.reuseNote ?? body.message);
      if (body.charged) void refreshAccount(true);
    } catch {
      setStatusText("浏览器没有送到查询接口。请再试一次。如果刚才那次其实已经受理，相同条件短时间内再点可能被算作重复任务。");
    } finally {
      setRunning(false);
    }
  }

  function saveRows() {
    const rows = visibleRows;
    if (!session || !rows.length) {
      toast.error("当前列表没有可写入的词。");
      return;
    }
    const capped = rows.slice(0, 200);
    addMeasured(capped.map((row) => ({
      keyword: row.keyword,
      monthlySearches: row.monthlySearches,
      competition: row.competition,
      bidLow: row.bidLow,
      bidHigh: row.bidHigh,
      bidCurrency: row.bidCurrency,
      trendIndex: row.trendIndex,
      cpc: row.cpc,
      source: `DataForSEO · ${session.response.modeLabel}`,
      productId: matchProductId(row.keyword),
      note: [
        session.response.channel,
        row.roleLabel,
        `${session.response.languageLabel} / ${session.response.locationLabel}`,
        row.competitionIndex == null ? null : `竞争指数 ${row.competitionIndex}`,
        row.note,
        "来自 DataForSEO。没有数字的记为未知，不是 0。CPC 和页首出价不是广告账户实际花费。趋势热度不是月搜索量。",
      ].filter(Boolean).join(" · "),
    })));
    toast.success(`已写入 ${capped.length} 条实测。来源 DataForSEO。`);
  }

  const spec = DFS_MODES.find((item) => item.id === mode) ?? DFS_MODES[0];
  const resultMode = session?.response.mode ?? mode;
  const asksVolume = resultMode !== "trends";
  const asksTrend = resultMode === "trends";
  const setupBlocked = account?.ok === false && account.code !== "network";
  const canSearch = !checking && account != null && !setupBlocked;
  const quote = account?.ok ? account.prices.find((item) => item.mode === mode) ?? null : null;
  const result = session?.response ?? null;
  const filteredRows = (result?.rows ?? []).filter((row) => !filter.trim() || row.keyword.toLowerCase().includes(filter.trim().toLowerCase()));
  const visibleRows = filteredRows;

  return (
    <Card id="dataforseo" className="scroll-mt-24 p-4">
      <SectionTitle title="DataForSEO 检索" action={<ProvBadge kind={result?.rows.length ? "measured" : "unknown"} />} />
      <p className="text-sm leading-6 text-muted-foreground">
        选一种查询，填写关键词，再点「开始检索」。打开本页只核对账户是否配好、余额和价目，不会创建关键字任务，也不会扣查询费。默认只做一次搜索量查询。相同条件如果本浏览器或服务器刚查过，会直接用那份结果并写明，不再次扣费。返回的数字标为实测，来源是 DataForSEO；没返回的保持未知。
      </p>
      <div className="mt-3 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm md:col-span-2 xl:col-span-4">
            {mode === "volume" ? "关键词" : "种子关键词"}
            {mode === "volume" ? (
              <Textarea rows={4} value={text} onChange={(event) => setText(event.target.value)} placeholder={"一行一个词，或用逗号分开。例如：\nsilicone utensil\nwholesale kitchen gadgets"} />
            ) : (
              <Input
                value={text}
                maxLength={100}
                placeholder="例如 silicone utensil"
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || !canSearch || running || !text.trim()) return;
                  event.preventDefault();
                  void runSearch(false);
                }}
              />
            )}
          </label>
          <label className="space-y-1 text-sm xl:col-span-2">
            查询
            <FieldSelect
              value={mode}
              onChange={(value) => setMode(value as DfsMode)}
              options={DFS_MODES.map((item) => ({ value: item.id, label: `${item.label} · ${item.channel}` }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            市场
            <FieldSelect
              value={marketId}
              onChange={(value) => {
                setMarketId(value);
                const next = DFS_MARKETS.find((item) => item.id === value);
                if (next) setLanguageCode(next.languageCode);
              }}
              options={DFS_MARKETS.map((item) => ({ value: item.id, label: item.label }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            语言
            <FieldSelect value={languageCode} onChange={setLanguageCode} options={DFS_LANGUAGES.map((item) => ({ value: item.id, label: item.label }))} />
          </label>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {spec.detail} 中东不是一个地区，请选阿联酋或沙特。英国对应英国、英语。从单品页进来只会预填，不会自动查询。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!canSearch || running || !text.trim()} onClick={() => void runSearch(false)}>
            {running ? "检索中…" : "开始检索"}
          </Button>
          <Button variant="outline" disabled={!canSearch || running || !text.trim()} onClick={() => void runSearch(true)}>
            重新请求（会计费）
          </Button>
          <Button variant="outline" disabled={checking} onClick={() => void refreshAccount()}>
            {checking ? "正在检查账户…" : "查看账户"}
          </Button>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-sm leading-6" aria-live="polite">
        {checking ? <p>正在检查 DataForSEO 配置和余额…这一步只走不计费的账户接口，不会查关键字。</p> : null}
        {account?.ok ? (
          <p>
            已连接 DataForSEO。余额 {account.balance == null ? "未知" : formatUsd(account.balance)}。
            {quote?.cost == null ? "当前这一档的标价未知。点「开始检索」仍会按账户价目扣一次。" : `当前这一档标价约 ${formatUsd(quote.cost)} / 次。这是价目，不是已经扣掉的费用。`}
            {account.note}
          </p>
        ) : null}
        {account && !account.ok ? <p>{account.message}</p> : null}
        <p>{statusText}</p>
        {session ? <p>下面如果有表，是本浏览器留下的上次结果。打开页面没有为了显示它再向 DataForSEO 查词。</p> : null}
      </div>
      {result ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{result.keywords.join("、")}</span>
            <span className="text-muted-foreground">{result.modeLabel} · {result.languageLabel} / {result.locationLabel} · {result.channel}</span>
            <ProvBadge kind="measured" />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {result.reuseNote ?? result.message}
            {result.charged && result.cost != null ? ` 本次费用 ${formatUsd(result.cost)}。` : ""}
            {result.fetchedAt ? ` 结果时间 ${new Date(result.fetchedAt).toLocaleString("zh-CN", { hour12: false })}。` : ""}
          </p>
          {result?.mode === "trends" ? <p className="text-xs leading-5 text-muted-foreground">趋势热度不是月搜索量。这一档没有查月搜索、CPC 和页首出价，那些格子是 —，不是 0，也不会拿热度去填。</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Input className="max-w-xs" value={filter} placeholder="在当前结果里筛词" onChange={(event) => setFilter(event.target.value)} />
            <Button size="sm" onClick={saveRows}>写入当前列表到实测词表</Button>
          </div>
          <p className="text-xs text-muted-foreground">写入词表后，单品页能对上的词会用实测盖住示例。来源会写成 DataForSEO。</p>
          {visibleRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-2">词</th>
                    {asksTrend ? <th className="py-2 pr-2">类型</th> : null}
                    <th className="py-2 pr-2">月搜索</th>
                    <th className="py-2 pr-2">热度</th>
                    <th className="py-2 pr-2">CPC</th>
                    <th className="py-2 pr-2">竞争</th>
                    <th className="py-2">页首出价</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => (
                    <ResultRow key={`${row.roleLabel ?? ""}-${row.keyword}-${index}`} row={row} asksVolume={asksVolume} asksTrend={asksTrend} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">这次没有可展示的词。没有返回的搜索量和热度保持未知，不会补 0。</p>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function ResultRow({ row, asksVolume, asksTrend }: { row: DfsKeywordRow; asksVolume: boolean; asksTrend: boolean }) {
  const volume = metricText(row.monthlySearches, asksVolume, (value) => value.toLocaleString("zh-CN"));
  const trend = metricText(row.trendIndex, asksTrend, (value) => String(value));
  const cpc = metricText(row.cpc, asksVolume, formatUsd);
  const competitionAsked = asksVolume;
  const competitionKnown = row.competition != null || row.competitionIndex != null;
  const competition = !competitionAsked
    ? "—"
    : competitionKnown
      ? [row.competition, row.competitionIndex == null ? null : `指数 ${row.competitionIndex}`].filter(Boolean).join(" · ")
      : "未知";
  const bidsAsked = asksVolume;
  const bidsKnown = row.bidLow != null || row.bidHigh != null;
  const bids = !bidsAsked
    ? "—"
    : bidsKnown
      ? `${row.bidLow == null ? "未知" : formatUsd(row.bidLow)}–${row.bidHigh == null ? "未知" : formatUsd(row.bidHigh)}`
      : "未知";
  return (
    <tr className="border-b align-top">
      <td className="py-2 pr-2">
        {row.keyword}
        <span className="mt-1 block"><ProvBadge kind="measured" /></span>
        {row.note ? <span className="mt-1 block text-xs leading-5 text-muted-foreground">{row.note}</span> : null}
      </td>
      {asksTrend ? <td className="py-2 pr-2">{row.roleLabel ?? "—"}</td> : null}
      <MetricCell text={volume.text} known={volume.known} asked={volume.asked} />
      <MetricCell text={trend.text} known={trend.known} asked={trend.asked} />
      <MetricCell text={cpc.text} known={cpc.known} asked={cpc.asked} />
      <td className="py-2 pr-2">
        {competition}
        {competitionAsked ? <span className="ml-1"><ProvBadge kind={competitionKnown ? "measured" : "unknown"} /></span> : null}
      </td>
      <td className="py-2">
        {bids}
        {bidsAsked ? <span className="ml-1"><ProvBadge kind={bidsKnown ? "measured" : "unknown"} /></span> : null}
      </td>
    </tr>
  );
}

function MetricCell({ text, known, asked }: { text: string; known: boolean; asked: boolean }) {
  return (
    <td className="py-2 pr-2">
      {text}
      {asked ? <span className="ml-1"><ProvBadge kind={known ? "measured" : "unknown"} /></span> : null}
    </td>
  );
}
