import { SERVER_CACHE_TTL_MS } from "./constants";
import type { DfsLookupResponse } from "./types";

interface Entry {
  at: number;
  body: DfsLookupResponse;
}

const store = new Map<string, Entry>();
const MAX = 40;

function clone(body: DfsLookupResponse): DfsLookupResponse {
  return { ...body, rows: body.rows.map((row) => ({ ...row })) };
}

export function clearLookupCache() {
  store.clear();
}

export function takeCachedLookup(scope: string, key: string, now = Date.now()) {
  const hit = store.get(`${scope}|${key}`);
  if (!hit) return null;
  if (now - hit.at > SERVER_CACHE_TTL_MS) {
    store.delete(`${scope}|${key}`);
    return null;
  }
  return clone(hit.body);
}

export function storeLookup(scope: string, key: string, body: DfsLookupResponse, now = Date.now()) {
  if (!body.ok || body.reused) return;
  const id = `${scope}|${key}`;
  store.set(id, { at: now, body: clone(body) });
  if (store.size <= MAX) return;
  const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at)[0];
  if (oldest) store.delete(oldest[0]);
}
