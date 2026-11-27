"use client";

import { FieldSelect, GradeMark, LinkButton, MoneyRange, ProvBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getProduct } from "@/lib/catalog";
import { BUYER_TYPES, CATEGORIES, CERT_OPTIONS, MARKETS } from "@/lib/markets";
import { recommendFor } from "@/lib/recommend";
import { scoreProduct } from "@/lib/scoring";
import { useStore } from "@/lib/storage";
import type { CategoryId, MarketId } from "@/lib/types";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const EMPTY = {
  title: "",
  customer: "",
  requirements: "",
  priceMin: "",
  priceMax: "",
  moq: "",
  buyerType: "进口批发商",
  notes: "",
  certs: [] as string[],
};

export function RecommendScreen() {
  const { state, settings, workspace, saveCase, deleteCase, setReportProducts, setMarket } = useStore();
  const [form, setForm] = useState({ ...EMPTY, market: workspace.market, category: workspace.category === "all" ? "funny" : workspace.category });
  const [activeCase, setActiveCase] = useState(state.cases[0]?.id ?? "");
  const preview = useMemo(() => {
    const inquiry = toInquiry(form);
    return recommendFor(inquiry).slice(0, 8);
  }, [form]);
  const saved = state.cases.find((item) => item.id === activeCase) ?? state.cases[0];

  function loadSeed() {
    const seed = state.inquiries.find((item) => item.sampleCase) ?? state.inquiries[0];
    if (!seed) return;
    setForm({
      title: seed.title,
      customer: seed.customer,
      requirements: seed.requirements,
      priceMin: seed.priceMin?.toString() ?? "",
      priceMax: seed.priceMax?.toString() ?? "",
      moq: seed.moq?.toString() ?? "",
      buyerType: seed.buyerType || "礼品公司",
      notes: seed.notes,
      certs: seed.certs,
      market: seed.market,
      category: seed.category === "all" ? "funny" : seed.category,
    });
    toast.message("已载入示例询盘，还没有写入新案例");
  }

  function submit() {
    if (!form.requirements.trim()) {
      toast.error("先写客户要什么");
      return;
    }
    const id = saveCase(toInquiry(form), form.notes);
    setActiveCase(id);
    setMarket(form.market);
    toast.success("推荐案例已保存到这台浏览器");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Recommend</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">按需推荐</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          把客户的市场、价带、起订和原话放进来，得到一份可以转发的推荐。匹配分最高 96，因为目录条件和搜索信号仍有未知，不打满分。
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">客户需求</h2>
            <Button variant="ghost" size="sm" onClick={loadSeed}>载入示例</Button>
          </div>
          <div className="space-y-3">
            <Field label="案例标题"><Input value={form.title} placeholder="例如：德国客户要厨房小件" onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
            <Field label="客户称呼"><Input value={form.customer} placeholder="公司或联系人" onChange={(event) => setForm({ ...form, customer: event.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="市场">
                <FieldSelect value={form.market} onChange={(value) => setForm({ ...form, market: value as MarketId })} options={MARKETS.filter((item) => settings.markets.includes(item.id)).map((item) => ({ value: item.id, label: `${item.name} · ${item.lang}` }))} />
              </Field>
              <Field label="类目">
                <FieldSelect value={form.category} onChange={(value) => setForm({ ...form, category: value as CategoryId })} options={CATEGORIES.filter((item) => settings.categories.includes(item.id)).map((item) => ({ value: item.id, label: item.name }))} />
              </Field>
            </div>
            <Field label="需求原文">
              <Textarea value={form.requirements} rows={5} placeholder="客户原话：场景、数量感觉、不能碰的点" onChange={(event) => setForm({ ...form, requirements: event.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="FOB 低"><Input inputMode="decimal" value={form.priceMin} onChange={(event) => setForm({ ...form, priceMin: event.target.value })} /></Field>
              <Field label="FOB 高"><Input inputMode="decimal" value={form.priceMax} onChange={(event) => setForm({ ...form, priceMax: event.target.value })} /></Field>
              <Field label="可接受起订"><Input inputMode="numeric" value={form.moq} onChange={(event) => setForm({ ...form, moq: event.target.value })} /></Field>
            </div>
            <Field label="买家类型">
              <FieldSelect value={form.buyerType} onChange={(buyerType) => setForm({ ...form, buyerType })} options={BUYER_TYPES.map((item) => ({ value: item, label: item }))} />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">客户提到的认证</legend>
              <div className="grid grid-cols-2 gap-2">
                {CERT_OPTIONS.map((cert) => (
                  <label key={cert} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.certs.includes(cert)}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          certs: checked ? [...form.certs, cert] : form.certs.filter((item) => item !== cert),
                        })
                      }
                    />
                    {cert}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">勾选只用于匹配「需核实」清单，不会变成已获证。</p>
            </fieldset>
            <Field label="内部备注"><Textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            <Button className="w-full" onClick={submit}>生成并保存推荐</Button>
          </div>
        </Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">实时预览 · 前 8</h2>
            <ProvBadge kind="sample" />
          </div>
          {preview.map((item, index) => {
            const scored = scoreProduct(item.product, form.market);
            return (
              <Card key={item.productId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">#{index + 1} 匹配 {item.score}</p>
                    <p className="text-lg font-semibold">{item.product.nameZh}</p>
                    <p className="text-sm text-muted-foreground">{item.product.nameEn}</p>
                  </div>
                  {scored ? <GradeMark grade={scored.grade} /> : <ProvBadge kind="unknown" />}
                </div>
                <p className="mt-2 text-sm">示例价带 <MoneyRange pair={item.product.priceUsd} settings={settings} /> · 起订 {item.product.moq} · 交期 {item.product.leadDays[0]}–{item.product.leadDays[1]} 天</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-6">
                  {item.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                <p className="mt-2 text-sm text-muted-foreground">风险：{item.risks.join("；")}</p>
                <p className="text-sm text-muted-foreground">未知：{item.unknowns.join("；")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <LinkButton href={`/products/${item.product.id}`} size="sm" variant="outline">单品</LinkButton>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${item.pitchZh}\n\n${item.pitchEn}`); toast.success("话术已复制"); }}>复制话术</Button>
                </div>
              </Card>
            );
          })}
          {!preview.length ? <p className="text-sm text-muted-foreground">这个类目在设置里被关掉了。</p> : null}
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">已保存的案例</h2>
          {saved ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setReportProducts(saved.selectedProductIds, saved.id)}>放到报告</Button>
              {saved.inquiry.sampleCase ? null : <Button size="sm" variant="ghost" onClick={() => deleteCase(saved.id)}>删除</Button>}
            </div>
          ) : null}
        </div>
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {state.cases.map((item) => (
            <Button key={item.id} size="sm" variant={item.id === saved?.id ? "default" : "outline"} onClick={() => setActiveCase(item.id)}>
              {item.inquiry.sampleCase ? "示例 · " : ""}{item.inquiry.title || item.inquiry.customer || "未命名"}
            </Button>
          ))}
        </div>
        {saved ? (
          <div className="space-y-3">
            {saved.inquiry.sampleCase ? <p className="text-sm text-amber-800 dark:text-amber-200">这是第一次打开时放进来的示例案例，方便看推荐长什么样。删除前可以先自己存一单真需求。</p> : null}
            <p className="text-sm leading-6">{saved.inquiry.requirements}</p>
            <div className="grid gap-3 lg:grid-cols-2">
              {saved.results.slice(0, 4).map((item) => {
                const product = getProduct(item.productId);
                if (!product) return null;
                return (
                  <div key={item.productId} className="rounded-lg border p-3">
                    <p className="font-medium">{product.nameZh} · 匹配 {item.score}</p>
                    <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{item.pitchZh}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">还没有案例。</p>}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function toInquiry(form: typeof EMPTY & { market: MarketId; category: CategoryId }) {
  const num = (value: string) => (value.trim() === "" || Number.isNaN(Number(value)) ? null : Number(value));
  return {
    title: form.title.trim() || "未命名推荐",
    customer: form.customer.trim(),
    market: form.market,
    category: form.category,
    requirements: form.requirements.trim(),
    priceMin: num(form.priceMin),
    priceMax: num(form.priceMax),
    moq: num(form.moq),
    certs: form.certs,
    buyerType: form.buyerType,
    notes: form.notes.trim(),
  };
}
