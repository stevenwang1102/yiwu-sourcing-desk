"use client";

import { GradeMark, LinkButton, ProvBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MARKET_MAP } from "@/lib/markets";
import { useStore } from "@/lib/storage";
import { trendBoard, type TrendCard } from "@/lib/trends";
import { toast } from "sonner";

export function TrendsScreen() {
  const { workspace, settings, setReportProducts } = useStore();
  const board = trendBoard(workspace.market, workspace.category);
  const market = MARKET_MAP[workspace.market];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Trends</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">行情推新</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          {market.name} · {market.lang}。这里是销售主动开口的清单：上升、季节、新品窗口，以及本周值得发一版的货。所有趋势百分比都是示例信号，发之前用 Google Trends 看相对热度。
        </p>
      </div>
      <section>
        <h2 className="mb-3 font-medium">本周值得发</h2>
        {board.week.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {board.week.map((card) => (
              <TrendArticle key={card.id} card={card} onReport={() => setReportProducts([card.product.id], null)} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">这个市场的目录没有主推单品，所以没有示例趋势。搜索量保持未知，到数据工位按这个国家的语言查。</p>
        )}
      </section>
      <Board title="示例趋势向上" cards={board.rising} empty="当前筛选里没有被标成上行的单品。" onReport={(id) => setReportProducts([id], null)} />
      <Board title="季节窗口" cards={board.seasonal} empty="当前筛选没有节日或换季标记。11 月前后，礼品和年初健身会更多出现在其他类目。" onReport={(id) => setReportProducts([id], null)} />
      <Board title="新品窗口" cards={board.fresh} empty="没有标成新品窗口的单品。新品不等于好做，先看合规未知项。" onReport={(id) => setReportProducts([id], null)} />
      <p className="text-xs leading-5 text-muted-foreground">
        公司名「{settings.companyName}」出现在报告抬头。推新话术默认不冒充工厂，也不把示例趋势说成 Keyword Planner 的结果。
      </p>
    </div>
  );
}

function Board({ title, cards, empty, onReport }: { title: string; cards: TrendCard[]; empty: string; onReport: (id: string) => void }) {
  return (
    <section>
      <h2 className="mb-3 font-medium">{title}</h2>
      {cards.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((card) => <TrendArticle key={card.id} card={card} onReport={() => onReport(card.product.id)} />)}
        </div>
      ) : <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function TrendArticle({ card, onReport }: { card: TrendCard; onReport: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{card.product.nameEn}</p>
          <h3 className="font-semibold">{card.product.nameZh}</h3>
        </div>
        <div className="flex items-center gap-2">
          {card.grade ? <GradeMark grade={card.grade} /> : null}
          <ProvBadge kind="sample" />
        </div>
      </div>
      <p className="mt-2 text-sm leading-6">{card.title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.why}</p>
      <p className="mt-2 text-sm">发给：{card.who}</p>
      <p className="text-sm">留意：{card.caution}</p>
      <p className="mt-1 text-xs text-muted-foreground">示例趋势 {card.trend == null ? "未知" : `${card.trend > 0 ? "+" : ""}${card.trend}%`} · 示例指数 {card.index ?? "未知"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <LinkButton href={`/products/${card.product.id}`} size="sm" variant="outline">单品</LinkButton>
        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(card.pitch); toast.success("推新话术已复制"); }}>复制话术</Button>
        <Button size="sm" variant="ghost" onClick={onReport}>放入报告</Button>
      </div>
    </Card>
  );
}
