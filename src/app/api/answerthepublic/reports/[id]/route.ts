import { ATP_PROVIDERS } from "@/lib/atp/constants";
import { getReport } from "@/lib/atp/client";
import { connection, NextRequest } from "next/server";

const PROVIDERS = new Set<string>(ATP_PROVIDERS.map((item) => item.id));

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const pageRaw = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.min(20, Math.max(1, Math.floor(pageRaw))) : 1;
  const grouped = request.nextUrl.searchParams.get("grouped") !== "0";
  const providerRaw = request.nextUrl.searchParams.get("provider");
  const provider = providerRaw && PROVIDERS.has(providerRaw) ? providerRaw : null;
  const result = await getReport(id, { page, grouped, provider });
  return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
