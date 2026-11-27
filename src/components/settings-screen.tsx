"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME_ZH } from "@/lib/brand";
import { CATEGORIES, MARKETS } from "@/lib/markets";
import { INQUIRY_FORMULA } from "@/lib/sources";
import { keywordStatus } from "@/lib/keyword-origin";
import { useStore } from "@/lib/storage";
import type { CategoryId, MarketId } from "@/lib/types";
import { toast } from "sonner";

export function SettingsScreen() {
  const { settings, updateSettings, resetAll, state } = useStore();
  const measuredCount = state.measured.filter((row) => keywordStatus(row) === "measured").length;

  function toggleMarket(id: MarketId, on: boolean) {
    const markets = on ? [...settings.markets, id] : settings.markets.filter((item) => item !== id);
    if (!markets.length) {
      toast.error("至少留一个市场");
      return;
    }
    updateSettings({ markets, defaultMarket: markets.includes(settings.defaultMarket) ? settings.defaultMarket : markets[0] });
  }

  function toggleCategory(id: CategoryId, on: boolean) {
    const categories = on ? [...settings.categories, id] : settings.categories.filter((item) => item !== id);
    if (!categories.length) {
      toast.error("至少留一个类目");
      return;
    }
    updateSettings({ categories });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">公司显示名用在报告抬头。侧栏固定为{PRODUCT_NAME_ZH}。请使用你们自己的名称，不要把工具假装成某个官方品牌。</p>
      </div>
      <Card className="space-y-3 p-4">
        <Label htmlFor="company">公司显示名</Label>
        <Input id="company" value={settings.companyName} onChange={(event) => updateSettings({ companyName: event.target.value || PRODUCT_NAME_ZH })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            显示货币
            <select className="h-8 w-full rounded-lg border bg-transparent px-2" value={settings.currency} onChange={(event) => updateSettings({ currency: event.target.value as "USD" | "CNY" })}>
              <option value="USD">美元</option>
              <option value="CNY">人民币（按假设汇率）</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            假设汇率：1 美元兑人民币
            <Input inputMode="decimal" value={settings.fxUsdCny} onChange={(event) => updateSettings({ fxUsdCny: Number(event.target.value) || settings.fxUsdCny })} />
          </label>
        </div>
      </Card>
      <Card className="p-4">
        <h2 className="font-medium">默认市场与类目</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MARKETS.map((market) => (
            <label key={market.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={settings.markets.includes(market.id)} onCheckedChange={(checked) => toggleMarket(market.id, Boolean(checked))} />
              {market.name} · {market.lang}
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {CATEGORIES.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={settings.categories.includes(category.id)} onCheckedChange={(checked) => toggleCategory(category.id, Boolean(checked))} />
              {category.name}
            </label>
          ))}
        </div>
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-medium">假设比率</h2>
        <p className="text-sm leading-6 text-muted-foreground">{INQUIRY_FORMULA}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">询盘率
            <Input inputMode="decimal" value={settings.inquiryRate} onChange={(event) => updateSettings({ inquiryRate: clampRate(event.target.value, settings.inquiryRate) })} />
          </label>
          <label className="space-y-1 text-sm">点击份额
            <Input inputMode="decimal" value={settings.clickShare} onChange={(event) => updateSettings({ clickShare: clampRate(event.target.value, settings.clickShare) })} />
          </label>
          <label className="space-y-1 text-sm">验证点击次数
            <Input inputMode="numeric" value={settings.testClicks} onChange={(event) => updateSettings({ testClicks: Math.max(1, Number(event.target.value) || settings.testClicks) })} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">0.02 表示 2%。改这里不会把结果变成实测。</p>
      </Card>
      <Card className="p-4">
        <h2 className="font-medium">示例数据</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          当前有 {state.cases.length} 个案例、词库 {state.measured.length} 条（其中实测 {measuredCount} 条）、{state.customers.length} 个客户、{state.serp.length} 行搜索观察。恢复示例会清掉这些录入和客户名单，清掉本浏览器里尚未写入词表的 AnswerThePublic 和 DataForSEO 结果，并放回预置的美国礼品询盘。
        </p>
        <Button className="mt-3" variant="destructive" onClick={() => { resetAll(); toast.success("已恢复示例数据"); }}>恢复示例并清空录入</Button>
      </Card>
    </div>
  );
}

function clampRate(value: string, fallback: number) {
  const next = Number(value);
  if (Number.isNaN(next)) return fallback;
  return Math.min(1, Math.max(0, next));
}
