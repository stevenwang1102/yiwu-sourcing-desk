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
            ? "检测到环境变量，但本版本不会外呼，避免误扣费。"
            : "未配置数据商。这次检查没有向任何接口发请求。"
          : "未执行查询。本接口不读取密钥去请求数据商，也不会自动扣费。请在数据工位粘贴导出表。",
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
