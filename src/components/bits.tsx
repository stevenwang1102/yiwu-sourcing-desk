"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatRange } from "@/lib/format";
import type { Provenance, Settings } from "@/lib/types";
import { cn } from "cn";
import Link from "next/link";

const PROV: Record<Provenance | "verify" | "catalog" | "user", { label: string; className: string }> = {
  sample: { label: "示例", className: "border-amber-600/30 bg-amber-500/12 text-amber-800 dark:text-amber-200" },
  measured: { label: "实测", className: "border-emerald-700/30 bg-emerald-600/12 text-emerald-800 dark:text-emerald-200" },
  unknown: { label: "未知", className: "border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground" },
  assumption: { label: "假设", className: "border-sky-700/30 bg-sky-600/10 text-sky-900 dark:text-sky-200" },
  verify: { label: "需核实", className: "border-orange-700/30 bg-orange-500/12 text-orange-900 dark:text-orange-100" },
  catalog: { label: "目录", className: "border-border bg-muted text-muted-foreground" },
  user: { label: "用户标注已核实", className: "border-emerald-800/40 bg-emerald-700/15 text-emerald-900 dark:text-emerald-100" },
};

export function ProvBadge({
  kind,
  className,
  suppressHydrationWarning,
}: {
  kind: keyof typeof PROV;
  className?: string;
  suppressHydrationWarning?: boolean;
}) {
  const item = PROV[kind];
  return (
    <Badge
      variant="outline"
      suppressHydrationWarning={suppressHydrationWarning}
      className={cn("h-5 rounded-md px-1.5 font-normal", item.className, className)}
    >
      {item.label}
    </Badge>
  );
}

export function Money({ usd, settings, className }: { usd: number; settings: Settings; className?: string }) {
  return (
    <span className={className}>
      {formatMoney(usd, settings)}
      {settings.currency === "CNY" ? <ProvBadge kind="assumption" className="ml-1 align-middle" /> : null}
    </span>
  );
}

export function MoneyRange({ pair, settings }: { pair: [number, number]; settings: Settings }) {
  return (
    <span>
      {formatRange(pair, settings)}
      {settings.currency === "CNY" ? <ProvBadge kind="assumption" className="ml-1 align-middle" /> : null}
    </span>
  );
}

export function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        {kicker ? <p className="text-[11px] tracking-[0.14em] text-muted-foreground uppercase">{kicker}</p> : null}
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/60 px-4 py-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function FieldSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const items = Object.fromEntries(options.map((option) => [option.value, option.label]));
  return (
    <Select
      value={value}
      items={items}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next);
      }}
    >
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LinkButton({
  href,
  children,
  variant,
  size,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "xs" | "icon-sm";
  className?: string;
}) {
  return (
    <Button nativeButton={false} variant={variant} size={size} className={className} render={<Link href={href} />}>
      {children}
    </Button>
  );
}

export function GradeMark({ grade }: { grade: "A" | "B" | "C" }) {
  const tone = grade === "A" ? "bg-primary text-primary-foreground" : grade === "B" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground";
  return <span className={cn("inline-flex size-6 items-center justify-center rounded-md text-xs font-semibold", tone)}>{grade}</span>;
}
