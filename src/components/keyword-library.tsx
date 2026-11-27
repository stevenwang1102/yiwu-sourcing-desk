"use client";

import { FieldSelect, ProvBadge, SectionTitle } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PRODUCTS } from "@/lib/catalog";
import {
  HAND_ORIGINS,
  KEYWORD_ORIGINS,
  assignCustomerPhrase,
  formatMetric,
  formatUpdated,
  keywordStatus,
  originLabel,
} from "@/lib/keyword-origin";
import { matchProductId } from "@/lib/match-product";
import { useStore } from "@/lib/storage";
import type { KeywordOrigin, MeasuredKeyword } from "@/lib/types";
import { cn } from "cn";
import { useMemo, useState, type SelectHTMLAttributes } from "react";
import { toast } from "sonner";

function costLabel(row: MeasuredKeyword) {
  if (row.cpc != null) return `CPC $${formatMetric(row.cpc)}`;
  if (row.bidLow != null || row.bidHigh != null) {
    const currency = row.bidCurrency ? ` ${row.bidCurrency}` : "";
    return `${formatMetric(row.bidLow)}–${formatMetric(row.bidHigh)}${currency}`;
  }
  return "未知";
}

function CellSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-card px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    />
  );
}

export function KeywordLibrary() {
  const { state, addCustomer, removeCustomer, setAssignCustomer, addMeasured, updateMeasured, removeMeasured } = useStore();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<KeywordOrigin | "all">("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [showCustomers, setShowCustomers] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualKeyword, setManualKeyword] = useState("");
  const [manualOrigin, setManualOrigin] = useState<KeywordOrigin>("manual");
  const [showAll, setShowAll] = useState(false);

  const originOptions = useMemo(
    () => [{ value: "all", label: "全部来源" }, ...KEYWORD_ORIGINS.map((item) => ({ value: item.id, label: item.label }))],
    [],
  );
  const customerOptions = useMemo(
    () => [
      { value: "all", label: "全部客户" },
      { value: "none", label: "未指定" },
      ...state.customers.map((item) => ({ value: item.id, label: item.name })),
    ],
    [state.customers],
  );
  const assignOptions = useMemo(
    () => [{ value: "none", label: "不指定" }, ...state.customers.map((item) => ({ value: item.id, label: item.name }))],
    [state.customers],
  );

  const customerFilterValue = customerFilter !== "all" && customerFilter !== "none" && !state.customers.some((item) => item.id === customerFilter)
    ? "all"
    : customerFilter;
  const filtered = state.measured.filter((row) => {
    if (originFilter !== "all" && row.origin !== originFilter) return false;
    if (customerFilterValue === "none" && row.customerId) return false;
    if (customerFilterValue !== "all" && customerFilterValue !== "none" && row.customerId !== customerFilterValue) return false;
    if (query && !row.keyword.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const visible = showAll ? filtered : filtered.slice(0, 80);
  const assigned = assignCustomerPhrase(state.customers, state.assignCustomerId);

  function applySearch() {
    setQuery(draft.trim());
    setShowAll(false);
  }

  function saveCustomer() {
    const result = addCustomer(customerName);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setAssignCustomer(result.customer.id);
    setCustomerName("");
    toast.success(`已添加客户「${result.customer.name}」。之后写入的词会归到这位客户，也可以在表里改。`);
  }

  function saveManual() {
    const keyword = manualKeyword.trim();
    if (keyword.length < 2) {
      toast.error("请先写关键词，至少 2 个字符。");
      return;
    }
    const origin = HAND_ORIGINS.includes(manualOrigin) ? manualOrigin : "manual";
    addMeasured([
      {
        keyword,
        monthlySearches: null,
        competition: null,
        bidLow: null,
        bidHigh: null,
        bidCurrency: null,
        trendIndex: null,
        cpc: null,
        source: originLabel(origin),
        origin,
        customerId: state.assignCustomerId,
        productId: matchProductId(keyword),
        note: "手动记入关键词库。搜索量、竞争度、CPC 和热度都空着，页面上显示未知。",
      },
    ]);
    setManualKeyword("");
    toast.success(`已写入「${keyword}」。来源 ${originLabel(origin)}，客户 ${assigned}。搜索量保持未知。`);
  }

  return (
    <Card className="p-4" id="keyword-library" data-testid="keyword-library">
      <SectionTitle
        kicker="Word bank"
        title="关键词库"
        action={<span className="text-xs text-muted-foreground">共 {state.measured.length} 条 · 当前 {filtered.length} 条</span>}
      />
      <p className="mb-3 max-w-3xl text-sm leading-6 text-muted-foreground">
        这是数据工位的实测词表。客户是海外买家，来源是这条词实际的取得方式。从下面的检索或粘贴写入时，来源会自动带上；客户用「新写入归到」，之后仍可在表里改。
      </p>
      <div className="flex flex-col gap-2 rounded-xl border bg-muted/40 p-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          aria-label="搜索关键词"
          data-testid="keyword-search"
          className="h-9 bg-card sm:max-w-xs sm:flex-1"
          placeholder="搜索关键词"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (!event.target.value.trim()) setQuery("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") applySearch();
          }}
        />
        <div className="w-full sm:w-40">
          <FieldSelect
            ariaLabel="来源"
            value={originFilter}
            onChange={(value) => setOriginFilter(value as KeywordOrigin | "all")}
            options={originOptions}
          />
        </div>
        <div className="w-full sm:w-40">
          <FieldSelect
            ariaLabel="客户"
            value={customerFilterValue}
            onChange={setCustomerFilter}
            options={customerOptions}
          />
        </div>
        <Button className="sm:ml-auto" onClick={applySearch}>搜索</Button>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0">新写入归到</span>
          <span className="block w-44">
            <FieldSelect
              ariaLabel="新写入归到的客户"
              value={state.assignCustomerId ?? "none"}
              onChange={(value) => setAssignCustomer(value === "none" ? null : value)}
              options={assignOptions}
            />
          </span>
        </label>
        <Button size="sm" variant="outline" onClick={() => setShowCustomers((open) => !open)}>
          {showCustomers ? "收起客户" : "客户"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowManual((open) => !open)}>
          {showManual ? "收起录入" : "手动录入"}
        </Button>
      </div>
      {showCustomers ? (
        <div className="mt-3 rounded-xl border border-dashed p-3">
          <p className="text-sm font-medium">客户</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">只记一个名字，用来把词归到海外买家。这里不存联系方式，也不是客户管理系统。</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="新客户名字"
              value={customerName}
              placeholder="例如：北美礼品公司"
              onChange={(event) => setCustomerName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveCustomer();
              }}
            />
            <Button size="sm" onClick={saveCustomer}>添加</Button>
          </div>
          {state.customers.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {state.customers.map((customer) => (
                <li key={customer.id} className="flex items-center gap-1 rounded-lg border bg-card px-2 py-1 text-sm">
                  <span>{customer.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeCustomer(customer.id)}>删除</Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">还没有客户。添加后就可以在表里选择。</p>
          )}
        </div>
      ) : null}
      {showManual ? (
        <div className="mt-3 rounded-xl border border-dashed p-3">
          <p className="text-sm font-medium">手动录入</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            只保存关键词。搜索量、竞争度、CPC 和热度留空，显示为未知。归到客户：{assigned}。
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              aria-label="手动录入的关键词"
              className="sm:flex-1"
              value={manualKeyword}
              placeholder="例如 wholesale kids bath toy"
              onChange={(event) => setManualKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveManual();
              }}
            />
            <div className="w-full sm:w-36">
              <FieldSelect
                ariaLabel="手动录入的来源"
                value={manualOrigin}
                onChange={(value) => setManualOrigin(value as KeywordOrigin)}
                options={HAND_ORIGINS.map((id) => ({ value: id, label: originLabel(id) }))}
              />
            </div>
            <Button size="sm" onClick={saveManual}>写入词库</Button>
          </div>
        </div>
      ) : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm" data-testid="keyword-table">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 pr-3 font-medium">关键词</th>
              <th className="py-2 pr-3 font-medium">客户</th>
              <th className="py-2 pr-3 font-medium">来源</th>
              <th className="py-2 pr-3 font-medium">竞争度</th>
              <th className="py-2 pr-3 font-medium">月搜索</th>
              <th className="py-2 pr-3 font-medium">热度</th>
              <th className="py-2 pr-3 font-medium">CPC / 出价</th>
              <th className="py-2 pr-3 font-medium">状态</th>
              <th className="py-2 pr-3 font-medium">更新时间</th>
              <th className="py-2 pr-3 font-medium">单品</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length ? visible.map((row) => {
              const sourceDetail = row.source !== originLabel(row.origin) ? row.source : "";
              const product = row.productId ? PRODUCTS.find((item) => item.id === row.productId) : null;
              return (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="max-w-[16rem] py-2 pr-3 align-middle font-medium">{row.keyword}</td>
                  <td className="w-36 py-2 pr-3 align-middle">
                    <CellSelect
                      aria-label={`${row.keyword} 的客户`}
                      value={row.customerId ?? ""}
                      onChange={(event) => updateMeasured(row.id, { customerId: event.target.value || null })}
                    >
                      <option value="">未指定</option>
                      {state.customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>{customer.name}</option>
                      ))}
                    </CellSelect>
                  </td>
                  <td className="w-40 py-2 pr-3 align-middle">
                    <CellSelect
                      aria-label={`${row.keyword} 的来源`}
                      value={row.origin}
                      onChange={(event) => updateMeasured(row.id, { origin: event.target.value as KeywordOrigin })}
                    >
                      {KEYWORD_ORIGINS.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </CellSelect>
                    {sourceDetail ? <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{sourceDetail}</p> : null}
                  </td>
                  <td className="py-2 pr-3 align-middle">{row.competition?.trim() ? row.competition : "未知"}</td>
                  <td className="py-2 pr-3 align-middle">{formatMetric(row.monthlySearches)}</td>
                  <td className="py-2 pr-3 align-middle">{formatMetric(row.trendIndex)}</td>
                  <td className="py-2 pr-3 align-middle whitespace-nowrap">{costLabel(row)}</td>
                  <td className="py-2 pr-3 align-middle"><ProvBadge kind={keywordStatus(row)} /></td>
                  <td className="py-2 pr-3 align-middle text-xs whitespace-nowrap text-muted-foreground">{formatUpdated(row.pastedAt)}</td>
                  <td className="py-2 pr-3 align-middle text-xs">{product?.nameZh ?? "未挂上"}</td>
                  <td className="py-2 align-middle"><Button size="sm" variant="ghost" onClick={() => removeMeasured(row.id)}>移除</Button></td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center">
                  <p className="font-medium">{state.measured.length ? "没有符合当前筛选的词" : "词库里还没有词"}</p>
                  <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                    {state.measured.length
                      ? "换一个客户或来源，或清空搜索后再看。"
                      : "从下面的 AnswerThePublic、DataForSEO 写入当前列表，把关键字规划师或 Trends 表贴进来，或在这里手动录入。手动录入只保存词和客户，搜索量保持未知。"}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > visible.length ? (
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setShowAll(true)}>还有 {filtered.length - visible.length} 条，显示全部</Button>
        </div>
      ) : null}
    </Card>
  );
}
