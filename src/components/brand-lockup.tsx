import { PRODUCT_MARK_SRC, PRODUCT_NAME_EN, PRODUCT_NAME_ZH } from "@/lib/brand";
import { cn } from "cn";
import Image from "next/image";

const TONE = {
  sidebar: {
    box: "gap-2.5",
    mark: "size-10",
    px: 40,
    name: "text-[15px] leading-tight font-semibold text-sidebar-foreground",
    en: "mt-0.5 text-[10px] leading-tight tracking-[0.04em] text-sidebar-foreground/65",
  },
  header: {
    box: "gap-2",
    mark: "size-8",
    px: 32,
    name: "text-sm leading-tight font-semibold text-foreground",
    en: "text-[9px] leading-tight tracking-[0.04em] text-muted-foreground",
  },
  report: {
    box: "gap-3",
    mark: "size-11",
    px: 44,
    name: "text-2xl leading-tight font-semibold text-zinc-900",
    en: "mt-0.5 text-[11px] leading-tight tracking-[0.06em] text-zinc-500",
  },
} as const;

export function BrandLockup({
  tone,
  name = PRODUCT_NAME_ZH,
  nameAs: NameTag = "p",
}: {
  tone: keyof typeof TONE;
  name?: string;
  nameAs?: "p" | "h2";
}) {
  const style = TONE[tone];
  return (
    <div className={cn("flex min-w-0 items-center", style.box)}>
      <Image src={PRODUCT_MARK_SRC} alt="ZK" width={style.px} height={style.px} priority={tone === "sidebar"} className={cn(style.mark, "shrink-0")} />
      <div className="min-w-0">
        <NameTag className={style.name}>{name}</NameTag>
        <p className={style.en}>{PRODUCT_NAME_EN}</p>
      </div>
    </div>
  );
}
