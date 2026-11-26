import { DFS_SESSION_KEY } from "./constants";
import type { DfsLookupResponse } from "./types";

export interface DfsSession {
  v: 1;
  savedAt: string;
  baseMessage: string;
  response: DfsLookupResponse;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

let cachedRaw: string | null = null;
let cachedSession: DfsSession | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function parseSession(raw: string | null): DfsSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const record = asRecord(parsed);
    const response = asRecord(record?.response);
    if (!record || record.v !== 1 || typeof record.savedAt !== "string" || typeof record.baseMessage !== "string") return null;
    if (!response || response.ok !== true || typeof response.cacheKey !== "string" || !Array.isArray(response.rows)) return null;
    return parsed as DfsSession;
  } catch {
    return null;
  }
}

export function subscribeDfsSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDfsSession() {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(DFS_SESSION_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = parseSession(raw);
  }
  return cachedSession;
}

export function getServerDfsSession(): DfsSession | null {
  return null;
}

export function writeDfsSession(session: DfsSession) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(session);
  cachedRaw = raw;
  cachedSession = session;
  sessionStorage.setItem(DFS_SESSION_KEY, raw);
  emit();
}

export function clearDfsSession() {
  if (typeof window === "undefined") return;
  cachedRaw = null;
  cachedSession = null;
  sessionStorage.removeItem(DFS_SESSION_KEY);
  emit();
}

export function sessionFromLookup(response: DfsLookupResponse): DfsSession {
  return {
    v: 1,
    savedAt: response.fetchedAt,
    baseMessage: response.message,
    response,
  };
}
