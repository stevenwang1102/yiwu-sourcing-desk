function payload(status: number) {
  const configured = Boolean(process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_PASSWORD);
  return Response.json(
    {
      ok: status === 200,
      configured,
      calledProvider: false,
      billing: "disabled",
      code: status === 200 ? "STATUS_ONLY" : "NOT_CONFIGURED",
      message:
        status === 200
          ? configured
            ? "检测到 DataForSEO 环境变量。这个占位地址仍然不会外呼。请到数据工位点「开始检索」，那一次才会查询。"
            : "未配置 DataForSEO。这次检查没有向任何接口发请求。"
          : "未执行查询。这个占位地址不读取密钥，也不会扣费。请到数据工位点「开始检索」。",
    },
    { status },
  );
}

export function GET() {
  return payload(200);
}

export function POST() {
  return payload(501);
}
