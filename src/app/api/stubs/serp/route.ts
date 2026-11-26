export function GET() {
  return Response.json({
    ok: true,
    calledProvider: false,
    billing: "disabled",
    message: "SERP 接口未启用。请在数据工位粘贴当次搜索观察到的标题和链接。看不到广告时不要补行。",
  });
}

export function POST() {
  return Response.json(
    {
      ok: false,
      code: "NOT_CONFIGURED",
      calledProvider: false,
      message: "未抓取搜索结果，也没有产生数据商费用。",
    },
    { status: 501 },
  );
}
