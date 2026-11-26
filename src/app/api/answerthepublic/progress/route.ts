import { connection } from "next/server";
import { pollSearches } from "@/lib/atp/client";

export async function POST(request: Request) {
  await connection();
  const raw = await request.json().catch(() => null);
  const result = await pollSearches(raw);
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
