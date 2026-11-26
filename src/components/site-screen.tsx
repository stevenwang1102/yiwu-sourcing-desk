"use client";

import { LinkButton, ProvBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PRODUCTS } from "@/lib/catalog";
import { MARKET_MAP } from "@/lib/markets";
import { useStore } from "@/lib/storage";
import { useState } from "react";

export function SiteScreen() {
  const { workspace, settings } = useStore();
  const pool = PRODUCTS.filter((product) => product.markets.includes(workspace.market));
  const initial = pool.find((product) => workspace.reportProductIds.includes(product.id)) ?? pool[0];
  const [id, setId] = useState(initial?.id ?? "");
  const product = PRODUCTS.find((item) => item.id === id) ?? initial;
  const market = MARKET_MAP[workspace.market];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Optional</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">独立站规划</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          这不是主路径。贸易公司的日常是按需推荐和行情推新。只有买家明确说想要一个自己能改的产品目录站时，才用这一页做提纲。
        </p>
      </div>
      <Card className="p-4 text-sm leading-6">
        <p className="font-medium">先问三件事，再谈建站</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>谁付钱、谁每周改产品？如果没人维护，站点会停在示例文案。</li>
          <li>关键字规划师里，批发词有没有实测搜索量？没有的话，站点解决不了「没人搜」。</li>
          <li>认证是否仍是需核实？站点上只能预留证书区，不能先写已通过。</li>
        </ul>
      </Card>
      {!product ? <p className="text-sm text-muted-foreground">当前市场没有主推单品。</p> : (
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="flex max-h-[480px] flex-col gap-1 overflow-auto">
            {pool.map((item) => (
              <Button key={item.id} variant={item.id === product.id ? "default" : "outline"} className="justify-start" onClick={() => setId(item.id)}>
                {item.nameZh}
              </Button>
            ))}
          </div>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{market.name} · {market.lang} · 示例提纲</p>
            <h2 className="text-xl font-semibold">{product.nameZh}</h2>
            <p className="text-sm text-muted-foreground">{product.nameEn}</p>
            <div className="mt-4 space-y-3 text-sm leading-6">
              <p><b>站点角色。</b>写成市场采购与拼柜服务，不写成「我们是工厂」。首页讲服务的市场和类目，产品页讲规格、示例起订和询盘。</p>
              <p><b>语言。</b>{market.note}</p>
              <p><b>建议页面。</b>首页、{product.category === "kids" ? "玩具" : "类目"}列表、本单品页、采购说明（起订、交期、包装）、合规与证书（全部需核实）、询盘。</p>
              <p><b>单品页模块。</b>双语名称、规格、包装、示例价带旁注明「报价以确认为准」、交期、目标买家、询盘表。不要放购物车，除非客户后来明确要零售。</p>
              <p><b>先不要做的事。</b>不要为了这一款就上广告到空首页。不要把 WordPress 当成选品结论。WordPress 只是买家日后自己改目录时的一种后台，Fluent Forms 或同类表单可以收询盘，事务邮件另选服务，这些都不是今天要决定的。</p>
              <p><b>还缺的数据。</b>当地语言的实测搜索量、当次搜索前十、工厂实价。缺的保持未知。<ProvBadge kind="unknown" /></p>
            </div>
            <LinkButton href={`/products/${product.id}`} className="mt-4" variant="outline">回到单品分析</LinkButton>
          </Card>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{settings.companyName} 不会在这一页生成可上线的网站。</p>
    </div>
  );
}
