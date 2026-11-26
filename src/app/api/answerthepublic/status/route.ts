import { connection } from "next/server";
import { getAccount } from "@/lib/atp/client";

export async function GET() {
  await connection();
  const result = await getAccount();
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
