import { runLookup } from "@/lib/dfs/client";
import { connection } from "next/server";

export const maxDuration = 120;

export async function POST(request: Request) {
  await connection();
  const raw = await request.json().catch(() => null);
  const result = await runLookup(raw);
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  await connection();
  return Response.json(
    {
      ok: false,
      configured: false,
      code: "method",
      message: "查询只能在数据工位点「开始检索」之后发起。用浏览器打开这个地址不会向 DataForSEO 查词，也不会扣费。",
      retryAfterSeconds: null,
    },
    { status: 405, headers: { "Cache-Control": "no-store" } },
  );
}
