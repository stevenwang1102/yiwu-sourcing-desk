import { getAccount } from "@/lib/dfs/client";
import { connection } from "next/server";

export async function GET() {
  await connection();
  const result = await getAccount();
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
