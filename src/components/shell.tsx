"use client";

import { FieldSelect, LinkButton, ProvBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { CATEGORIES, MARKETS } from "@/lib/markets";
import { useStore } from "@/lib/storage";
import { cn } from "cn";
import { BarChart3, FileText, FlaskConical, Menu, Moon, Settings, Sparkles, Sun, Table2, X } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "选品大盘", icon: BarChart3, hint: "看结构" },
  { href: "/recommend", label: "按需推荐", icon: Sparkles, hint: "客户来了" },
  { href: "/trends", label: "行情推新", icon: Table2, hint: "主动出击" },
  { href: "/products", label: "单品分析", icon: FlaskConical, hint: "拆一个品" },
  { href: "/report", label: "选品报告", icon: FileText, hint: "一页给同事" },
  { href: "/data", label: "数据工位", icon: FlaskConical, hint: "查词实测" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings, workspace, setMarket, setCategory, state } = useStore();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const markets = MARKETS.filter((item) => settings.markets.includes(item.id));
  const categories = CATEGORIES.filter((item) => settings.categories.includes(item.id));
  const measured = state.measured.length;

  const nav = (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-4">
        <p className="text-[11px] tracking-[0.18em] text-sidebar-foreground/60 uppercase">Yiwu sourcing desk</p>
        <p className="mt-1 text-lg leading-tight font-semibold text-sidebar-foreground">{settings.companyName}</p>
        <p className="mt-1 text-xs leading-5 text-sidebar-foreground/70">市场采购公司的选品工作台。推荐给海外买家，不是工厂建站决策。</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                active && "bg-sidebar-accent text-sidebar-foreground",
              )}
            >
              <Icon className="size-4 opacity-80" />
              <span className="flex-1">{item.label}</span>
              <span className="text-[10px] text-sidebar-foreground/50">{item.hint}</span>
            </Link>
          );
        })}
        <div className="my-3 h-px bg-sidebar-border" />
        <Link href="/site" onClick={() => setOpen(false)} className={cn("rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent", pathname.startsWith("/site") && "bg-sidebar-accent text-sidebar-foreground")}>
          独立站规划
          <span className="ml-2 text-[10px] text-sidebar-foreground/50">可选</span>
        </Link>
        <Link href="/settings" onClick={() => setOpen(false)} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent", pathname.startsWith("/settings") && "bg-sidebar-accent text-sidebar-foreground")}>
          <Settings className="size-4" /> 设置
        </Link>
      </nav>
      <div className="m-3 rounded-lg border border-sidebar-border bg-sidebar-accent/60 p-3 text-[11px] leading-5 text-sidebar-foreground/75">
        搜索量、CPC、难度、趋势和竞争结构在贴上工具导出之前都是示例。认证只写需核实。
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">{nav}</aside>
      {open ? (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="关闭菜单" />
          <div className="absolute inset-y-0 left-0 w-72 bg-sidebar shadow-xl">{nav}</div>
        </div>
      ) : null}
      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 md:px-5">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="打开菜单">
              {open ? <X /> : <Menu />}
            </Button>
            <div className="min-w-[140px] flex-1 md:max-w-[180px] md:flex-none">
              <FieldSelect
                value={workspace.market}
                onChange={(value) => setMarket(value as typeof workspace.market)}
                options={markets.map((item) => ({ value: item.id, label: `${item.name} · ${item.lang}` }))}
              />
            </div>
            <div className="min-w-[140px] flex-1 md:max-w-[180px] md:flex-none">
              <FieldSelect
                value={workspace.category}
                onChange={(value) => setCategory(value as typeof workspace.category)}
                options={[{ value: "all", label: "全部类目" }, ...categories.map((item) => ({ value: item.id, label: item.name }))]}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {workspace.compareIds.length ? (
                <LinkButton href="/compare" variant="outline" size="sm">
                  对比 {workspace.compareIds.length}
                </LinkButton>
              ) : null}
              <span className="hidden items-center gap-1 md:flex" suppressHydrationWarning>
                <ProvBadge kind={measured ? "measured" : "sample"} suppressHydrationWarning />
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                  {measured ? `${measured} 条实测词` : "尚无实测"}
                </span>
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="切换深色模式"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                <Sun className="hidden dark:block" />
                <Moon className="block dark:hidden" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground md:px-5">
            <span>本页未贴工具导出的搜索量、CPC、流量和趋势都是示例数据，不代表真实行情。</span>
            <ProvBadge kind="sample" />
            <ProvBadge kind="measured" />
            <ProvBadge kind="unknown" />
            <ProvBadge kind="assumption" />
            <ProvBadge kind="verify" />
          </div>
        </header>
        <main className="shell-main px-3 py-4 md:px-5 md:py-6">{children}</main>
      </div>
    </div>
  );
}
